// @page-pattern: list
// 标准列表契约由 renderEngineeringStandardListPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 调色任务模块：列表沿用标准任务页，详情通过工程主单事实服务完成三阶段操作。

import type { EngineeringTaskRecord } from '../../data/pcs-engineering-master-types.ts'
import { getEngineeringMasterOrderById } from '../../data/pcs-engineering-master-repository.ts'
import { getEngineeringTaskDefinition } from '../../data/pcs-engineering-dependency-policy.ts'
import {
  confirmEngineeringColorRequirements,
  listEngineeringColorBomLines,
  submitEngineeringColorResults,
} from '../../data/pcs-engineering-color-task-service.ts'
import { reviewEngineeringMaterialResults } from '../../data/pcs-engineering-task-review.ts'
import { assertEngineeringUploadedFilesReady, type EngineeringUploadPurpose } from '../../data/pcs-engineering-file-upload.ts'
import {
  listEngineeringTaskUploadedFiles,
  removeEngineeringTaskUploadedFile,
  uploadEngineeringTaskFiles,
} from '../../data/pcs-engineering-task-upload-repository.ts'
import { getEngineeringTeamCurrentOperator } from '../../data/pcs-engineering-team-directory.ts'
import { renderEngineeringFileUpload } from '../../components/ui/engineering-file-upload.ts'
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
  getEngineeringTaskListDetailPath,
  getEngineeringTaskSourceSummary,
  getEngineeringTaskSourceOptions,
  getEngineeringTaskTeamOptions,
  listEngineeringTasksByType,
  renderTaskDependencyCard,
  renderTaskLogsCard,
  renderTaskMaterialIdentity,
  renderTaskReworkRoundsCard,
  renderTaskWorkbenchHeader,
} from './master-task-common.ts'
import {
  changeTaskUiPage,
  getTaskUiActionNode,
  getTaskUiFeedbackContainer,
  getTaskUiValue,
  handleTaskUiInput,
  paginateTaskLines,
  refreshTaskUiRegion,
  setTaskUiFeedback,
} from './material-review-task-ui.ts'

const COLOR_TASK_TYPES = ['COLOR_YARN', 'COLOR_FABRIC'] as const
const COLOR_LIST_PATH = '/pcs/engineering/color'

function getColorTasksFiltered(): EngineeringTaskRecord[] {
  const tasks = listEngineeringTasksByType(COLOR_TASK_TYPES)
  const keyword = state.colorList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    const master = getEngineeringMasterOrderById(task.masterOrderId)
    const definition = getEngineeringTaskDefinition(task.taskType)
    const source = getEngineeringTaskSourceSummary(task)
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
    if (state.colorList.status !== 'all' && task.status !== state.colorList.status) return false
    if (state.colorList.owner !== 'all' && (task.status === '已完成' || task.ownerTeamName !== state.colorList.owner)) return false
    if (state.colorList.source !== 'all' && source.label !== state.colorList.source) return false
    if (state.colorList.quickFilter === 'in-progress' && task.status !== '进行中') return false
    if (state.colorList.quickFilter === 'pending-review' && task.status !== '待审核') return false
    if (state.colorList.quickFilter === 'rework' && task.status !== '返工中') return false
    if (state.colorList.quickFilter === 'completed' && task.status !== '已完成') return false
    return true
  })
}

const COLOR_LIST_COLUMNS = createEngineeringListColumns([
  { key: 'task', title: '调色任务', width: 210, required: true, freezeable: true, sortable: true },
  { key: 'master', title: '任务来源', width: 170, required: true, freezeable: true, sortable: true },
  { key: 'status', title: '状态', width: 130, required: true, freezeable: true, sortable: true },
  { key: 'team', title: '当前需处理的团队', width: 150, sortable: true },
  { key: 'material', title: '物料需求', width: 230, sortable: true },
  { key: 'rework', title: '返工', width: 100, sortable: true },
  { key: 'started', title: '开始时间', width: 170, sortable: true },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true },
])

function getColorListRows(): EngineeringListRow[] {
  return getColorTasksFiltered().map((task) => {
    const master = getEngineeringMasterOrderById(task.masterOrderId)
    const definition = getEngineeringTaskDefinition(task.taskType)
    const source = getEngineeringTaskSourceSummary(task)
    const detailPath = getEngineeringTaskListDetailPath(task, COLOR_LIST_PATH)
    return {
      cells: {
        task: `<div class="space-y-1">
          <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(detailPath)}">${escapeHtml(definition.taskName)}</button>
          <p class="text-xs text-slate-500">${escapeHtml(task.taskId)}</p>
        </div>`,
        master: master
          ? `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/engineering/masters/${escapeHtml(master.masterOrderId)}">${escapeHtml(source.code)}</button><p class="text-xs text-slate-500">${escapeHtml(source.label)}</p>`
          : `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(detailPath)}">${escapeHtml(source.code)}</button><p class="text-xs text-slate-500">${escapeHtml(source.label)}</p>`,
        status: renderStatusBadge(task.status),
        team: escapeHtml(task.status === '已完成' ? '-' : task.ownerTeamName || '-'),
        material: task.materialLines.length > 0
          ? escapeHtml(task.materialLines.map((line) => line.materialName).join('、'))
          : '<span class="text-slate-400">暂无物料</span>',
        rework: task.reworkRounds.length > 0
          ? `<span class="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">${task.reworkRounds.length} 轮</span>`
          : '<span class="text-slate-400">无</span>',
        started: escapeHtml(task.startedAt ? formatDateTime(task.startedAt) : '-'),
        actions: `<div class="flex flex-wrap gap-2">
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(detailPath)}">查看</button>
        </div>`,
      },
      sortValues: {
        task: definition.taskName,
        master: source.code,
        status: task.status,
        team: task.ownerTeamName || '',
        material: task.materialLines.map((line) => line.materialName).join('、'),
        rework: task.reworkRounds.length,
        started: task.startedAt,
      },
    }
  })
}

function renderColorListStats(): string {
  const tasks = listEngineeringTasksByType(COLOR_TASK_TYPES)
  return `<section class="flex flex-wrap gap-3">
    ${renderMetricButton('全部任务', tasks.length, state.colorList.quickFilter === 'all', 'all', 'set-color-quick-filter')}
    ${renderMetricButton('进行中', tasks.filter((item) => item.status === '进行中').length, state.colorList.quickFilter === 'in-progress', 'in-progress', 'set-color-quick-filter')}
    ${renderMetricButton('待审核', tasks.filter((item) => item.status === '待审核').length, state.colorList.quickFilter === 'pending-review', 'pending-review', 'set-color-quick-filter')}
    ${renderMetricButton('返工中', tasks.filter((item) => item.status === '返工中').length, state.colorList.quickFilter === 'rework', 'rework', 'set-color-quick-filter')}
    ${renderMetricButton('已完成', tasks.filter((item) => item.status === '已完成').length, state.colorList.quickFilter === 'completed', 'completed', 'set-color-quick-filter')}
  </section>`
}

function renderColorListPage(): string {
  const tasks = listEngineeringTasksByType(COLOR_TASK_TYPES)
  return renderEngineeringStandardListPage({
    module: 'color',
    title: '调色任务',
    createLabel: '查看工程主单',
    createAction: 'nav:/pcs/engineering/masters',
    filtersHtml: renderListFilters({
      searchPlaceholder: '搜索任务编号 / 任务名称 / 主单编号 / 款式编码 / 当前团队',
      listState: state.colorList,
      searchField: 'color-search',
      statusField: 'color-status',
      ownerField: 'color-owner',
      sourceField: 'color-source',
      statusOptions: ENGINEERING_TASK_FILTER_STATUS_OPTIONS,
      ownerOptions: getEngineeringTaskTeamOptions(tasks),
      sourceOptions: getEngineeringTaskSourceOptions(tasks),
    }),
    statsHtml: renderColorListStats(),
    rows: getColorListRows(),
    columns: COLOR_LIST_COLUMNS,
    listState: state.colorList,
    emptyText: '暂无调色任务数据',
  })
}

function renderColorDetailPage(taskId: string): string {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail) return renderEmptyDetail('调色任务', COLOR_LIST_PATH)
  const { task, master } = detail
  if (!COLOR_TASK_TYPES.includes(task.taskType as typeof COLOR_TASK_TYPES[number])) return renderEmptyDetail('调色任务', COLOR_LIST_PATH)
  const definition = getEngineeringTaskDefinition(task.taskType)
  const bomLines = listEngineeringColorBomLines(master.masterOrderId, task.taskId)
  const paged = paginateTaskLines('color', task.taskId, bomLines)
  const field = (lineId: string, name: string, fallback = '') => escapeHtml(getTaskUiValue('color', task.taskId, lineId, name, fallback))
  const stepOneRows = paged.lines.length > 0
    ? paged.lines.map((line) => `<tr class="border-t border-slate-100"><td class="px-4 py-3" colspan="2">${renderTaskMaterialIdentity(line)}</td><td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(line.materialType)}</td><td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(line.productColor || '-')}</td></tr>`).join('')
    : '<tr><td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">暂无染色物料</td></tr>'
  const stepOne = `<section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-4"><h2 class="text-base font-semibold text-slate-900">1 BOM 染色物料</h2></div><div class="overflow-x-auto"><table class="min-w-[720px] w-full"><thead class="bg-slate-50 text-left text-xs text-slate-500"><tr><th class="px-4 py-3" colspan="2">物料</th><th class="px-4 py-3">类型</th><th class="px-4 py-3">商品颜色</th></tr></thead><tbody>${stepOneRows}</tbody></table></div>${paged.paginationHtml}</section>`
  const canConfirmRequirements = bomLines.length > 0 && task.status === '进行中'
  const stepTwo = task.colorRequirementConfirmedAt
    ? `<section class="rounded-lg border border-emerald-200 bg-white"><div class="flex items-center justify-between border-b border-emerald-100 px-5 py-4"><h2 class="text-base font-semibold text-slate-900">2 跟单确认</h2><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">${escapeHtml(task.colorRequirementConfirmedBy)} 已确认</span></div><div class="grid gap-3 p-5 md:grid-cols-2">${paged.lines.map((line) => `<div class="rounded-md bg-slate-50 p-3 text-sm" data-color-requirement-readonly-row="${escapeHtml(line.materialLineId)}"><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="mt-1 text-slate-500">${escapeHtml(line.pantoneColorCode || '-')} · ${escapeHtml(line.colorName || '-')} · ${escapeHtml(line.dyeColorCode || '-')}</p></div>`).join('')}</div>${paged.paginationHtml}</section>`
    : canConfirmRequirements
      ? `<section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-4"><h2 class="text-base font-semibold text-slate-900">2 跟单确认</h2><p class="mt-1 text-xs text-slate-500">由当前登录的跟单维护潘通色号、颜色名称和染色色号。</p></div><div class="divide-y divide-slate-100">${paged.lines.map((line) => `<div class="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_1fr_1fr]" data-color-requirement-row="${escapeHtml(line.materialLineId)}"><div><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-xs text-slate-500">${escapeHtml(line.materialSkuId)}</p></div><input aria-label="潘通色号" class="h-9 rounded-md border border-slate-200 px-3 text-sm" value="${field(line.materialLineId, 'pantone', line.pantoneColorCode)}" data-review-ui-field="pantone" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}" placeholder="潘通色号"><input aria-label="颜色名称" class="h-9 rounded-md border border-slate-200 px-3 text-sm" value="${field(line.materialLineId, 'colorName', line.colorName)}" data-review-ui-field="colorName" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}" placeholder="颜色名称"><input aria-label="染色色号" class="h-9 rounded-md border border-slate-200 px-3 text-sm" value="${field(line.materialLineId, 'dyeCode', line.dyeColorCode)}" data-review-ui-field="dyeCode" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}" placeholder="染色色号"></div>`).join('')}</div>${paged.paginationHtml}<div class="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-review-ui-action="confirm-color" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}">确认染色要求</button></div></section>`
      : `<section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-4"><h2 class="text-base font-semibold text-slate-900">2 跟单确认</h2></div><p class="px-5 py-6 text-sm text-slate-500">${bomLines.length === 0 ? '暂无染色物料' : `当前状态：${escapeHtml(task.status)}`}</p></section>`
  const canSubmitResults = Boolean(task.colorRequirementConfirmedAt) && ['进行中', '返工中'].includes(task.status)
  const resultRows = paged.lines.map((line) => {
    const editable = line.reviewStatus !== '通过' && (task.status !== '返工中' || line.reviewStatus === '未通过')
    const files = listEngineeringTaskUploadedFiles(task.taskId, line.materialLineId, 'COLOR_RESULT')
    if (!editable) return `<div class="grid gap-3 px-5 py-4 md:grid-cols-[1fr_3fr]" data-color-result-row="${escapeHtml(line.materialLineId)}"><div><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-xs text-slate-500">${escapeHtml(line.materialSkuId)}</p></div><div><p class="mb-3 text-sm font-medium text-emerald-700">已通过，已锁定</p>${renderEngineeringFileUpload({ taskId: task.taskId, itemId: line.materialLineId, purpose: 'COLOR_RESULT', files, eventPrefix: 'color', locked: true, label: '本轮调色成果' })}</div></div>`
    return `<div class="grid gap-4 px-5 py-4 md:grid-cols-[240px_1fr]" data-color-result-row="${escapeHtml(line.materialLineId)}"><div><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-xs text-slate-500">${escapeHtml(line.materialSkuId)}</p>${line.reviewReason ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(line.reviewReason)}</p>` : ''}<label class="mt-3 block text-sm text-slate-600">染厂<input aria-label="染厂" class="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" value="${field(line.materialLineId, 'dyeFactory', line.dyeFactoryName)}" data-review-ui-field="dyeFactory" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}" placeholder="染厂"></label></div>${renderEngineeringFileUpload({ taskId: task.taskId, itemId: line.materialLineId, purpose: 'COLOR_RESULT', files, eventPrefix: 'color', label: '调色成果图／文件', requiredHint: '请上传真实调色样或染色效果图；保存成功后才能提交。' })}</div>`
  }).join('')
  const resultForm = canSubmitResults ? `<div class="divide-y divide-slate-100">${resultRows}</div>${paged.paginationHtml}<div class="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-review-ui-action="submit-color" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}">提交本轮调色成果</button></div>` : ''
  const reviewRows = paged.lines.map((line) => line.reviewStatus === '通过'
    ? `<div class="grid gap-3 px-5 py-4 md:grid-cols-[1fr_3fr]" data-color-review-row="${escapeHtml(line.materialLineId)}"><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-sm font-medium text-emerald-700">已通过，已锁定</p></div>`
    : `<div class="grid gap-3 px-5 py-4 md:grid-cols-[1fr_160px_2fr]" data-review-row="${escapeHtml(line.materialLineId)}"><div><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-xs text-slate-500">${escapeHtml(line.dyeFactoryName || '-')}</p></div><select aria-label="审核结论" class="h-9 rounded-md border border-slate-200 px-3 text-sm" data-review-ui-field="decision" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}"><option value="">请选择</option><option value="通过" ${getTaskUiValue('color', task.taskId, line.materialLineId, 'decision') === '通过' ? 'selected' : ''}>通过</option><option value="未通过" ${getTaskUiValue('color', task.taskId, line.materialLineId, 'decision') === '未通过' ? 'selected' : ''}>未通过</option></select><input aria-label="未通过原因" class="h-9 rounded-md border border-slate-200 px-3 text-sm" value="${field(line.materialLineId, 'reason')}" data-review-ui-field="reason" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}" placeholder="未通过时必填"></div>`).join('')
  const reviewForm = task.status === '待审核' ? `<div class="divide-y divide-slate-100">${reviewRows}</div>${paged.paginationHtml}<div class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-5 py-4"><span class="mr-auto text-xs text-slate-500">由当前登录的买手逐项审核；未通过项必须填写原因。</span><button type="button" class="h-9 rounded-md border border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-700" data-review-ui-action="pass-all-color" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}">全部通过</button><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-review-ui-action="review-color" data-review-ui-module="color" data-task-id="${escapeHtml(task.taskId)}">确认审核</button></div>` : ''
  const stepThree = `<section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-4"><h2 class="text-base font-semibold text-slate-900">3 染厂成果与买手审核</h2></div>${!task.colorRequirementConfirmedAt ? '<p class="px-5 py-6 text-sm text-slate-500">请先完成跟单确认。</p>' : ''}${resultForm}${reviewForm}${task.status === '已完成' ? '<p class="px-5 py-6 text-sm font-medium text-emerald-700">全部调色成果已通过</p>' : ''}</section>`
  return `<div class="space-y-5 p-4" data-engineering-review-detail="color:${escapeHtml(task.taskId)}" data-engineering-task-detail="color:${escapeHtml(task.taskId)}">${renderTaskWorkbenchHeader(task, master, 'color', COLOR_LIST_PATH)}<div data-review-ui-feedback role="alert" hidden></div>${stepOne}${stepTwo}${stepThree}${renderTaskReworkRoundsCard(task)}${renderTaskDependencyCard(task)}${renderTaskLogsCard(task, master, 'color')}</div>`
}

export function handleColorTaskInput(target: Element): boolean {
  const uploadInput = target.closest<HTMLInputElement>('[data-color-upload-input]')
  if (uploadInput) {
    const taskId = uploadInput.dataset.taskId || ''
    const purpose = uploadInput.dataset.uploadPurpose as EngineeringUploadPurpose
    const detail = getEngineeringTaskDetail(taskId)
    const container = getTaskUiFeedbackContainer(uploadInput, `[data-engineering-review-detail="color:${taskId}"]`)
    if (!detail || !uploadInput.files?.length) return true
    const operator = getEngineeringTeamCurrentOperator('染厂')
    setTaskUiFeedback(container, '正在读取并保存真实文件。', false)
    void uploadEngineeringTaskFiles({
      taskId,
      itemId: uploadInput.dataset.itemId || 'TASK',
      purpose,
      files: uploadInput.files,
      actor: { userId: operator.operatorId, userName: operator.operatorName, teamName: operator.teamName },
      roundNo: detail.task.currentRoundNo,
    })
      .then(() => refreshTaskUiRegion('color', taskId, renderColorDetailPage))
      .catch((error) => setTaskUiFeedback(container, error instanceof Error ? error.message : '文件上传失败，请重试。'))
    return true
  }
  return handleTaskUiInput(target, 'color')
}

export function handleColorTaskEvent(target: HTMLElement): boolean {
  const uploadRemove = target.closest<HTMLElement>('[data-color-upload-remove]')
  if (uploadRemove) {
    const taskId = uploadRemove.dataset.taskId || ''
    removeEngineeringTaskUploadedFile({
      taskId,
      itemId: uploadRemove.dataset.itemId || 'TASK',
      fileId: uploadRemove.dataset.fileId || '',
    })
    refreshTaskUiRegion('color', taskId, renderColorDetailPage)
    return true
  }
  const uploadPreview = target.closest<HTMLElement>('[data-color-upload-preview]')
  if (uploadPreview) {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-5'
    overlay.dataset.colorPreview = 'true'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', `${uploadPreview.dataset.fileName || '调色成果'}大图`)
    overlay.innerHTML = `<button type="button" aria-label="关闭大图" class="absolute right-6 top-6 rounded-full bg-white px-3 py-2 text-slate-800" data-skip-page-rerender="true" data-color-preview-close>关闭</button><img src="${escapeHtml(uploadPreview.dataset.fileUrl || '')}" alt="${escapeHtml(uploadPreview.dataset.fileName || '调色成果大图')}" class="max-h-full max-w-full object-contain">`
    document.body.appendChild(overlay)
    return true
  }
  if (target.closest('[data-color-preview-close]')) {
    document.querySelector('[data-color-preview="true"]')?.remove()
    return true
  }
  const node = getTaskUiActionNode(target, 'color')
  if (!node) return false
  const taskId = node.dataset.taskId || ''
  const action = node.dataset.reviewUiAction || ''
  const detail = getEngineeringTaskDetail(taskId)
  const container = getTaskUiFeedbackContainer(node, `[data-engineering-review-detail="color:${taskId}"]`)
  try {
    if (!detail || !COLOR_TASK_TYPES.includes(detail.task.taskType as typeof COLOR_TASK_TYPES[number])) throw new Error('调色任务不存在。')
    const { task, master } = detail
    const lines = listEngineeringColorBomLines(master.masterOrderId, taskId)
    const value = (lineId: string, field: string, fallback = '') => getTaskUiValue('color', taskId, lineId, field, fallback)
    if (action === 'page') {
      changeTaskUiPage('color', taskId, Number(node.dataset.page || 1))
    } else if (action === 'confirm-color') {
      const operator = getEngineeringTeamCurrentOperator('跟单')
      confirmEngineeringColorRequirements({
        masterOrderId: master.masterOrderId, taskId, confirmedBy: operator.operatorName,
        requirements: lines.map((line) => ({ materialLineId: line.materialLineId, pantoneColorCode: value(line.materialLineId, 'pantone', line.pantoneColorCode), colorName: value(line.materialLineId, 'colorName', line.colorName), dyeColorCode: value(line.materialLineId, 'dyeCode', line.dyeColorCode) })),
      })
    } else if (action === 'submit-color') {
      const resultLines = lines.filter((line) => line.reviewStatus !== '通过' && (task.status !== '返工中' || line.reviewStatus === '未通过'))
      const operator = getEngineeringTeamCurrentOperator('染厂')
      submitEngineeringColorResults({
        masterOrderId: master.masterOrderId,
        taskId,
        submittedBy: operator.operatorName,
        results: resultLines.map((line) => {
          const files = listEngineeringTaskUploadedFiles(taskId, line.materialLineId, 'COLOR_RESULT')
          assertEngineeringUploadedFilesReady(files, `${line.materialName}调色成果`)
          return {
            materialLineId: line.materialLineId,
            dyeFactoryName: value(line.materialLineId, 'dyeFactory', line.dyeFactoryName),
            resultFileIds: files.map((file) => file.dataUrl),
            effectImageIds: files.filter((file) => ['jpg', 'jpeg', 'png', 'webp'].includes(file.extension)).map((file) => file.dataUrl),
          }
        }),
      })
    } else if (action === 'review-color' || action === 'pass-all-color') {
      const pending = lines.filter((line) => line.reviewStatus === '待审核')
      const reviewer = getEngineeringTeamCurrentOperator('买手')
      reviewEngineeringMaterialResults({
        masterOrderId: master.masterOrderId, taskId, reviewerName: reviewer.operatorName, reviewerRole: '买手',
        decisions: pending.map((line) => ({ materialLineId: line.materialLineId, decision: action === 'pass-all-color' ? '通过' : value(line.materialLineId, 'decision') as '通过' | '未通过', reason: action === 'pass-all-color' ? '' : value(line.materialLineId, 'reason') })),
      })
    } else return false
    refreshTaskUiRegion('color', taskId, renderColorDetailPage)
    return true
  } catch (error) {
    setTaskUiFeedback(container, error instanceof Error ? error.message : '操作失败，请重试。')
    return true
  }
}

registerEngineeringListModule('color', {
  getColumns: () => COLOR_LIST_COLUMNS,
  getRows: () => getColorListRows(),
  getState: () => state.colorList,
  getEmptyText: () => '暂无调色任务数据',
  getStatsHtml: () => renderColorListStats(),
})

export function renderPcsColorTaskPage(): string {
  return renderColorListPage()
}

export function renderPcsColorTaskDetailPage(taskId: string): string {
  return renderColorDetailPage(taskId)
}
