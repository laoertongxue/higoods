// @page-pattern: list
// 标准列表契约由 renderEngineeringStandardListPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 产前版样衣任务：任务骨架、状态、依赖、负责人和时间只读工程主单任务事实。
// 跟单在工作安排中下达多行制作要求；制作团队逐行提交真实图片、实际数量和制作事实后完成，不设置二次审核。

import type { EngineeringSampleActualLine, EngineeringTaskRecord } from '../../data/pcs-engineering-master-types'
import { assertEngineeringUploadedFilesReady } from '../../data/pcs-engineering-file-upload'
import { getEngineeringTeamCurrentOperator } from '../../data/pcs-engineering-team-directory'
import {
  listEngineeringTaskUploadedFiles,
  removeEngineeringTaskUploadedFile,
  uploadEngineeringTaskFiles,
} from '../../data/pcs-engineering-task-upload-repository'
import { renderEngineeringFileUpload } from '../../components/ui/engineering-file-upload'
import {
  getEngineeringMasterOrderById,
  submitEngineeringTaskResult,
} from '../../data/pcs-engineering-master-repository'
import { listEngineeringPatternResultVersions } from '../../data/pcs-engineering-pattern-result'
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
interface SampleResultDraft {
  draftId: string
  requirementLineId: string
  actualColor: string
  actualSize: string
  actualQuantity: string
  sourcePatternVersion: string
  productionNote: string
  differenceNote: string
}

const resultDrafts = new Map<string, SampleResultDraft[]>()

function getResultDrafts(task: EngineeringTaskRecord): SampleResultDraft[] {
  const current = resultDrafts.get(task.taskId)
  if (current) return current
  const created = (task.sampleActuals?.length ? task.sampleActuals : (task.sampleRequirements || []).map((requirement) => ({
    actualLineId: '',
    requirementLineId: requirement.requirementLineId,
    actualColor: requirement.targetColor,
    actualSize: requirement.targetSize,
    actualQuantity: requirement.requiredQuantity,
    sourcePatternVersion: '',
    productionNote: requirement.requirementNote,
    differenceNote: '',
    imageFileIds: [],
    submittedBy: '',
    submittedAt: '',
  }))).map((line, index) => ({
    draftId: line.actualLineId || `${task.taskId}-ACTUAL-DRAFT-${index + 1}`,
    requirementLineId: line.requirementLineId,
    actualColor: line.actualColor,
    actualSize: line.actualSize,
    actualQuantity: String(line.actualQuantity),
    sourcePatternVersion: line.sourcePatternVersion,
    productionNote: line.productionNote,
    differenceNote: line.differenceNote,
  }))
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
  { key: 'team', title: '当前需处理的团队', width: 150, sortable: true },
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

function renderRequirementSummary(task: EngineeringTaskRecord): string {
  const requirements = task.sampleRequirements || []
  const expectedTotal = requirements.reduce((sum, line) => sum + line.requiredQuantity, 0)
  return renderSectionCard('跟单下达的制作要求', `<div class="mb-3 flex flex-wrap items-center justify-between gap-3"><p class="text-sm text-slate-500">任务开始后制作要求锁定。</p><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">合计 ${expectedTotal} 件</span></div><div class="overflow-x-auto"><table class="w-full min-w-[720px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">颜色</th><th class="p-3">尺码</th><th class="p-3">要求数量</th><th class="p-3">制作要求</th><th class="p-3">下达人</th></tr></thead><tbody>${requirements.map((line) => `<tr class="border-b"><td class="p-3">${escapeHtml(line.targetColor)}</td><td class="p-3">${escapeHtml(line.targetSize)}</td><td class="p-3">${line.requiredQuantity} 件</td><td class="p-3">${escapeHtml(line.requirementNote || '-')}</td><td class="p-3">${escapeHtml(line.issuedBy)}<small class="block text-slate-500">${escapeHtml(line.issuedAt)}</small></td></tr>`).join('') || '<tr><td colspan="5" class="p-6 text-center text-red-600">尚未下达制作要求</td></tr>'}</tbody></table></div>`)
}

function renderCompletedActuals(task: EngineeringTaskRecord): string {
  const actuals = task.sampleActuals || []
  const requirements = task.sampleRequirements || []
  const expectedTotal = requirements.reduce((sum, line) => sum + line.requiredQuantity, 0)
  const actualTotal = actuals.reduce((sum, line) => sum + line.actualQuantity, 0)
  return renderSectionCard('样衣实际交付', `<div class="mb-3 flex flex-wrap items-center justify-between gap-3"><p class="text-sm text-slate-500">提交人：${escapeHtml(task.resultSubmittedBy || '-')} · ${escapeHtml(task.submittedAt ? formatDateTime(task.submittedAt) : '-')}</p><span class="rounded-full ${actualTotal === expectedTotal ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} px-2 py-1 text-xs">要求 ${expectedTotal} 件 · 实际 ${actualTotal} 件 · ${actualTotal === expectedTotal ? '一致' : `相差 ${actualTotal - expectedTotal} 件`}</span></div><div class="overflow-x-auto"><table class="w-full min-w-[980px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">对应要求</th><th class="p-3">实际颜色</th><th class="p-3">实际尺码</th><th class="p-3">实际数量</th><th class="p-3">使用纸样</th><th class="p-3">制作说明</th><th class="p-3">差异说明</th></tr></thead><tbody>${actuals.map((line) => { const requirement = requirements.find((item) => item.requirementLineId === line.requirementLineId); return `<tr class="border-b"><td class="p-3">${requirement ? `${escapeHtml(requirement.targetColor)} / ${escapeHtml(requirement.targetSize)} / ${requirement.requiredQuantity} 件` : '-'}</td><td class="p-3">${escapeHtml(line.actualColor)}</td><td class="p-3">${escapeHtml(line.actualSize)}</td><td class="p-3">${line.actualQuantity} 件</td><td class="p-3">${escapeHtml(line.sourcePatternVersion)}</td><td class="p-3">${escapeHtml(line.productionNote)}</td><td class="p-3">${escapeHtml(line.differenceNote || '-')}</td></tr>` }).join('') || '<tr><td colspan="7" class="p-6 text-center text-slate-500">尚未提交实际交付</td></tr>'}</tbody></table></div>${actuals.flatMap((line) => line.imageFileIds).length ? `<div class="mt-4 grid gap-3 sm:grid-cols-3">${actuals.flatMap((line) => line.imageFileIds).map((url, index) => `<button type="button" class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left" data-skip-page-rerender="true" data-first-sample-action="preview-image" data-image-url="${escapeHtml(url)}" data-image-alt="${escapeHtml(`产前版样衣成果图 ${index + 1}`)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(`产前版样衣成果图 ${index + 1}`)}" class="h-36 w-full object-contain" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="block px-3 py-2 text-xs text-red-600">图片加载失败，请重新上传</span><span class="block px-3 py-2 text-xs text-slate-500">点击查看大图</span></button>`).join('')}</div>` : ''}`)
}

function availablePatternVersions(task: EngineeringTaskRecord): Array<{ value: string; label: string }> {
  const master = getEngineeringMasterOrderById(task.masterOrderId)
  return task.dependsOnTaskIds.flatMap((dependencyId) => {
    const dependency = master?.tasks.find((item) => item.taskId === dependencyId)
    return listEngineeringPatternResultVersions(dependencyId).map((version) => ({
      value: `${version.materialKind}${version.patternKind} ${version.versionLabel}`,
      label: `${dependency?.taskName || `${version.materialKind}${version.patternKind}`} · ${version.versionLabel}`,
    }))
  })
}

function renderResult(task: EngineeringTaskRecord): string {
  if (task.status !== '进行中') return `${renderRequirementSummary(task)}${renderCompletedActuals(task)}`
  const drafts = getResultDrafts(task)
  const requirements = task.sampleRequirements || []
  const patternVersions = availablePatternVersions(task)
  const rows = drafts.map((draft, index) => {
    const requirement = requirements.find((line) => line.requirementLineId === draft.requirementLineId)
    const uploadedFiles = listEngineeringTaskUploadedFiles(task.taskId, draft.draftId, 'SAMPLE_RESULT')
    return `<article class="space-y-3 rounded-lg border p-4" data-first-sample-result-row="${escapeHtml(draft.draftId)}"><div class="flex items-center justify-between gap-3"><strong>实际交付 ${index + 1}</strong>${drafts.length > requirements.length ? `<button type="button" class="text-sm text-red-600" data-first-sample-action="remove-result-row" data-task-id="${escapeHtml(task.taskId)}" data-draft-id="${escapeHtml(draft.draftId)}">删除</button>` : ''}</div><div class="grid gap-3 md:grid-cols-4"><label class="text-sm text-slate-600">对应制作要求<select class="mt-1 h-10 w-full rounded border px-2" data-first-sample-field="requirementLineId">${requirements.map((line) => `<option value="${escapeHtml(line.requirementLineId)}" ${line.requirementLineId === draft.requirementLineId ? 'selected' : ''}>${escapeHtml(line.targetColor)} / ${escapeHtml(line.targetSize)} / ${line.requiredQuantity} 件</option>`).join('')}</select></label><label class="text-sm text-slate-600">实际颜色<input class="mt-1 h-10 w-full rounded border px-3" data-first-sample-field="actualColor" value="${escapeHtml(draft.actualColor)}"></label><label class="text-sm text-slate-600">实际尺码<input class="mt-1 h-10 w-full rounded border px-3" data-first-sample-field="actualSize" value="${escapeHtml(draft.actualSize)}"></label><label class="text-sm text-slate-600">实际数量<input type="number" min="1" step="1" class="mt-1 h-10 w-full rounded border px-3" data-first-sample-field="actualQuantity" value="${escapeHtml(draft.actualQuantity)}"></label></div><div class="grid gap-3 md:grid-cols-3"><label class="text-sm text-slate-600">使用的纸样版本<select class="mt-1 h-10 w-full rounded border px-3" data-first-sample-field="sourcePatternVersion"><option value="">请选择已完成纸样版本</option>${patternVersions.map((version) => `<option value="${escapeHtml(version.value)}" ${version.value === draft.sourcePatternVersion ? 'selected' : ''}>${escapeHtml(version.label)}</option>`).join('')}</select></label><label class="text-sm text-slate-600">制作说明<input class="mt-1 h-10 w-full rounded border px-3" data-first-sample-field="productionNote" value="${escapeHtml(draft.productionNote)}"></label><label class="text-sm text-slate-600">差异说明<input class="mt-1 h-10 w-full rounded border px-3" data-first-sample-field="differenceNote" value="${escapeHtml(draft.differenceNote)}" placeholder="仅实际与要求不一致时必填"></label></div>${patternVersions.length ? '' : '<p class="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">尚无可用的已完成基码纸样版本，不能提交样衣成果。</p>'}${requirement ? `<p class="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">要求：${escapeHtml(requirement.targetColor)} / ${escapeHtml(requirement.targetSize)} / ${requirement.requiredQuantity} 件${requirement.requirementNote ? ` · ${escapeHtml(requirement.requirementNote)}` : ''}</p>` : ''}${renderEngineeringFileUpload({ taskId: task.taskId, itemId: draft.draftId, purpose: 'SAMPLE_RESULT', files: uploadedFiles, eventPrefix: 'first-sample', label: '本行产前版样衣实拍图', requiredHint: '请从本地选择并真实读取与本行实际样衣对应的图片。' })}</article>`
  }).join('')
  return `${renderRequirementSummary(task)}${renderSectionCard('提交本次实际交付', `<div data-first-sample-form="${escapeHtml(task.taskId)}"><div data-first-sample-feedback class="mb-3 hidden rounded-md px-3 py-2 text-sm" role="alert"></div><div class="mb-3 flex justify-end"><button type="button" class="rounded border px-3 py-2 text-sm" data-first-sample-action="add-result-row" data-task-id="${escapeHtml(task.taskId)}">新增实际交付</button></div><div class="space-y-4">${rows}</div><div class="mt-4 flex justify-end"><button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-skip-page-rerender="true" data-first-sample-action="submit-result" data-task-id="${escapeHtml(task.taskId)}">提交成果并完成任务</button></div></div>`)}`
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
  input: {
    sampleActuals: Array<Omit<EngineeringSampleActualLine, 'actualLineId' | 'submittedAt'> & {
      actualLineId?: string
      submittedAt?: string
    }>
  },
): EngineeringTaskRecord {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail || detail.task.taskType !== 'PRE_PRODUCTION_SAMPLE') throw new Error('未找到产前版样衣任务。')
  const permittedVersions = new Set(availablePatternVersions(detail.task).map((version) => version.value))
  if (!permittedVersions.size) throw new Error('尚无可用的已完成基码纸样版本，不能提交产前版样衣成果。')
  if (input.sampleActuals.some((actual) => !permittedVersions.has(actual.sourcePatternVersion.trim()))) {
    throw new Error('产前版样衣只能选择已完成的基码纸样版本。')
  }
  return submitEngineeringTaskResult(detail.master.masterOrderId, taskId, input).task
}

function syncResultDraftsFromDom(task: EngineeringTaskRecord): void {
  const drafts = getResultDrafts(task)
  document.querySelectorAll<HTMLElement>(`[data-first-sample-detail="${CSS.escape(task.taskId)}"] [data-first-sample-result-row]`).forEach((row) => {
    const draft = drafts.find((item) => item.draftId === row.dataset.firstSampleResultRow)
    if (!draft) return
    row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-first-sample-field]').forEach((field) => {
      const key = field.dataset.firstSampleField as keyof SampleResultDraft
      if (key in draft) draft[key] = field.value
    })
  })
}

export function handleFirstSampleTaskInput(target: Element): boolean {
  const uploadInput = target.closest<HTMLInputElement>('[data-first-sample-upload-input]')
  if (uploadInput) {
    const taskId = uploadInput.dataset.taskId || ''
    const detail = getEngineeringTaskDetail(taskId)
    if (!detail || !uploadInput.files?.length) return true
    syncResultDraftsFromDom(detail.task)
    const operator = getEngineeringTeamCurrentOperator(detail.task.ownerTeamName)
    void uploadEngineeringTaskFiles({
      taskId,
      itemId: uploadInput.dataset.itemId || 'TASK',
      purpose: 'SAMPLE_RESULT',
      files: uploadInput.files,
      actor: { userId: operator.operatorId, userName: operator.operatorName, teamName: operator.teamName },
      roundNo: detail.task.currentRoundNo,
    }).then(() => {
      const host = document.querySelector<HTMLElement>(`[data-first-sample-detail="${CSS.escape(taskId)}"]`)
      if (host) host.outerHTML = renderPcsFirstSampleTaskDetailPage(taskId)
    }).catch((error) => {
      const feedback = document.querySelector<HTMLElement>(`[data-first-sample-form="${CSS.escape(taskId)}"] [data-first-sample-feedback]`)
      if (feedback) { feedback.hidden = false; feedback.className = 'mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'; feedback.textContent = error instanceof Error ? error.message : '上传失败，请重试。' }
    })
    return true
  }
  const node = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-first-sample-field]')
  if (!node) return false
  const taskId = node.closest<HTMLElement>('[data-first-sample-detail]')?.dataset.firstSampleDetail || ''
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail) return false
  const draftId = node.closest<HTMLElement>('[data-first-sample-result-row]')?.dataset.firstSampleResultRow || ''
  const draft = getResultDrafts(detail.task).find((item) => item.draftId === draftId)
  if (!draft) return false
  const field = node.dataset.firstSampleField as keyof SampleResultDraft
  if (!(field in draft)) return false
  draft[field] = node.value
  return true
}

export function handleFirstSampleTaskEvent(target: HTMLElement): boolean {
  const uploadRemove = target.closest<HTMLElement>('[data-first-sample-upload-remove]')
  if (uploadRemove) {
    const taskId = uploadRemove.dataset.taskId || ''
    const detail = getEngineeringTaskDetail(taskId)
    if (detail) syncResultDraftsFromDom(detail.task)
    removeEngineeringTaskUploadedFile({ taskId, itemId: uploadRemove.dataset.itemId || 'TASK', fileId: uploadRemove.dataset.fileId || '' })
    const host = document.querySelector<HTMLElement>(`[data-first-sample-detail="${CSS.escape(taskId)}"]`)
    if (host) host.outerHTML = renderPcsFirstSampleTaskDetailPage(taskId)
    return true
  }
  const uploadPreview = target.closest<HTMLElement>('[data-first-sample-upload-preview]')
  if (uploadPreview) {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6'
    overlay.dataset.firstSamplePreview = 'true'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', `${uploadPreview.dataset.fileName || '产前版样衣'}大图`)
    overlay.innerHTML = `<button type="button" aria-label="关闭大图" class="absolute right-6 top-6 rounded-full bg-white px-3 py-2 text-slate-800" data-skip-page-rerender="true" data-first-sample-action="close-preview">关闭</button><img src="${escapeHtml(uploadPreview.dataset.fileUrl || '')}" alt="${escapeHtml(uploadPreview.dataset.fileName || '产前版样衣大图')}" class="max-h-full max-w-full object-contain">`
    document.body.appendChild(overlay)
    return true
  }
  const node = target.closest<HTMLElement>('[data-first-sample-action]')
  if (!node) return false
  const action = node.dataset.firstSampleAction || ''
  if (action === 'preview-image') {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6'
    overlay.dataset.firstSamplePreview = 'true'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', node.dataset.imageAlt || '产前版样衣大图')
    overlay.innerHTML = `<button type="button" aria-label="关闭大图" class="absolute right-6 top-6 rounded-full bg-white px-3 py-2 text-slate-800" data-skip-page-rerender="true" data-first-sample-action="close-preview">关闭</button><img src="${escapeHtml(node.dataset.imageUrl || '')}" alt="${escapeHtml(node.dataset.imageAlt || '产前版样衣大图')}" class="max-h-full max-w-full object-contain">`
    document.body.appendChild(overlay)
    return true
  }
  if (action === 'close-preview') {
    node.closest<HTMLElement>('[data-first-sample-preview]')?.remove()
    return true
  }
  if (action === 'add-result-row') {
    const taskId = node.dataset.taskId || ''
    const detail = getEngineeringTaskDetail(taskId)
    if (!detail) return true
    syncResultDraftsFromDom(detail.task)
    const requirement = detail.task.sampleRequirements?.[0]
    if (!requirement) return true
    getResultDrafts(detail.task).push({
      draftId: `${taskId}-ACTUAL-DRAFT-${Date.now()}`,
      requirementLineId: requirement.requirementLineId,
      actualColor: requirement.targetColor,
      actualSize: requirement.targetSize,
      actualQuantity: String(requirement.requiredQuantity),
      sourcePatternVersion: '',
      productionNote: requirement.requirementNote,
      differenceNote: '',
    })
    const host = document.querySelector<HTMLElement>(`[data-first-sample-detail="${CSS.escape(taskId)}"]`)
    if (host) host.outerHTML = renderPcsFirstSampleTaskDetailPage(taskId)
    return true
  }
  if (action === 'remove-result-row') {
    const taskId = node.dataset.taskId || ''
    const detail = getEngineeringTaskDetail(taskId)
    if (!detail) return true
    syncResultDraftsFromDom(detail.task)
    const draftId = node.dataset.draftId || ''
    const drafts = getResultDrafts(detail.task)
    if (drafts.length <= (detail.task.sampleRequirements?.length || 1)) return true
    listEngineeringTaskUploadedFiles(taskId, draftId, 'SAMPLE_RESULT').forEach((file) => {
      removeEngineeringTaskUploadedFile({ taskId, itemId: draftId, fileId: file.fileId })
    })
    resultDrafts.set(taskId, drafts.filter((draft) => draft.draftId !== draftId))
    const host = document.querySelector<HTMLElement>(`[data-first-sample-detail="${CSS.escape(taskId)}"]`)
    if (host) host.outerHTML = renderPcsFirstSampleTaskDetailPage(taskId)
    return true
  }
  if (action !== 'submit-result') return false
  const taskId = node.dataset.taskId || ''
  const detail = getEngineeringTaskDetail(taskId)
  const feedback = document.querySelector<HTMLElement>(`[data-first-sample-form="${CSS.escape(taskId)}"] [data-first-sample-feedback]`)
  try {
    if (!detail) throw new Error('未找到产前版样衣任务。')
    syncResultDraftsFromDom(detail.task)
    const operator = getEngineeringTeamCurrentOperator(detail.task.ownerTeamName)
    const sampleActuals = getResultDrafts(detail.task).map((draft) => {
      const files = listEngineeringTaskUploadedFiles(taskId, draft.draftId, 'SAMPLE_RESULT')
      assertEngineeringUploadedFilesReady(files, `产前版样衣实拍图（${draft.actualColor || '未填颜色'} / ${draft.actualSize || '未填尺码'}）`)
      return {
        actualLineId: draft.draftId,
        requirementLineId: draft.requirementLineId,
        actualColor: draft.actualColor,
        actualSize: draft.actualSize,
        actualQuantity: Number(draft.actualQuantity),
        sourcePatternVersion: draft.sourcePatternVersion,
        productionNote: draft.productionNote,
        differenceNote: draft.differenceNote,
        imageFileIds: files.map((file) => file.dataUrl),
        submittedBy: operator.operatorName,
      }
    })
    submitEngineeringFirstSampleResult(taskId, {
      sampleActuals,
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
