// @page-pattern: list
// 标准列表契约由 createMasterTaskPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 花型任务：列表沿用标准任务页；详情只读工程主单任务事实，并调用统一成果提交 / 审核服务。
import {
  reviewEngineeringMaterialResults,
  submitEngineeringMaterialResults,
} from '../../data/pcs-engineering-task-review.ts'
import type { EngineeringTaskMaterialLine, EngineeringTaskRecord } from '../../data/pcs-engineering-master-types.ts'
import { escapeHtml } from '../../utils.ts'
import {
  getEngineeringTaskDetail,
  renderTaskDependencyCard,
  renderTaskLogsCard,
  renderTaskMasterCard,
  renderTaskReworkRoundsCard,
  renderTaskSummaryCard,
} from './master-task-common.ts'
import { createMasterTaskPage } from './master-task-page.ts'
import {
  changeTaskUiPage,
  getTaskUiActionNode,
  getTaskUiFeedbackContainer,
  getTaskUiValue,
  handleTaskUiInput,
  paginateTaskLines,
  refreshTaskUiRegion,
  setTaskUiFeedback,
  splitTaskUiReferences,
} from './material-review-task-ui.ts'
import { renderEmptyDetail, renderHeaderMeta, renderStatusBadge, state } from './shared.ts'

const MODULE = 'pattern'
const PATH = '/pcs/patterns/artwork'

const page = createMasterTaskPage({
  module: MODULE,
  title: '花型任务',
  path: PATH,
  taskTypes: ['PATTERN_ARTWORK'],
  listState: state.patternList,
})

function inputValue(task: EngineeringTaskRecord, line: EngineeringTaskMaterialLine, field: string, fallback = ''): string {
  return escapeHtml(getTaskUiValue(MODULE, task.taskId, line.materialLineId, field, fallback))
}

function renderResultLine(task: EngineeringTaskRecord, line: EngineeringTaskMaterialLine): string {
  const isReworkTarget = task.status !== '返工中' || line.reviewStatus === '未通过'
  const editable = ['待开始', '进行中', '返工中'].includes(task.status)
    && line.reviewStatus !== '通过'
    && isReworkTarget
  if (!editable) {
    const statusText = line.reviewStatus === '通过' ? '已通过，已锁定' : line.reviewStatus
    return `<tr data-pattern-result-row="${escapeHtml(line.materialLineId)}" class="border-t border-slate-100">
      <td class="px-4 py-3"><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-xs text-slate-500">${escapeHtml(line.materialSkuId)}</p></td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(line.resultFileIds.join('、') || '-')}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(line.effectImageIds.join('、') || '-')}</td>
      <td class="px-4 py-3"><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">${escapeHtml(statusText)}</span>${line.reviewReason ? `<p class="mt-2 text-xs text-red-600">${escapeHtml(line.reviewReason)}</p>` : ''}</td>
    </tr>`
  }
  return `<tr data-pattern-result-row="${escapeHtml(line.materialLineId)}" class="border-t border-slate-100">
    <td class="px-4 py-3"><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-xs text-slate-500">${escapeHtml(line.materialSkuId)} · ${escapeHtml(line.productColor || '-')} · ${escapeHtml(line.printProcess || '-')}</p>${line.reviewReason ? `<p class="mt-2 text-xs text-red-600">${escapeHtml(line.reviewReason)}</p>` : ''}</td>
    <td class="px-4 py-3"><input aria-label="成果文件" class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm" value="${inputValue(task, line, 'resultFiles', line.resultFileIds.join(', '))}" data-review-ui-field="resultFiles" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}" placeholder="文件地址，多个用逗号分隔"></td>
    <td class="px-4 py-3"><input aria-label="效果图" class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm" value="${inputValue(task, line, 'effectImages', line.effectImageIds.join(', '))}" data-review-ui-field="effectImages" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}" placeholder="图片地址，多个用逗号分隔"></td>
    <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(line.reviewStatus === '未通过' ? '待返工' : '待提交')}</td>
  </tr>`
}

function renderPatternSubmission(task: EngineeringTaskRecord): string {
  const activeLines = task.materialLines.filter((line) => line.status === '正常')
  const paged = paginateTaskLines(MODULE, task.taskId, activeLines)
  const canSubmit = ['待开始', '进行中', '返工中'].includes(task.status)
  return `<section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 class="text-base font-semibold text-slate-900">花型成果</h2><p class="mt-1 text-xs text-slate-500">${task.status === '返工中' ? '本轮只提交未通过物料' : '逐项维护后整单提交'}</p></div>${task.reworkRounds.length ? `<span class="text-xs text-orange-600">第 ${task.reworkRounds.length + 1} 轮</span>` : ''}</div>
    <div class="overflow-x-auto"><table class="min-w-[880px] w-full"><thead class="bg-slate-50 text-left text-xs text-slate-500"><tr><th class="px-4 py-3">物料</th><th class="px-4 py-3">成果文件</th><th class="px-4 py-3">效果图</th><th class="px-4 py-3">状态</th></tr></thead><tbody>${paged.lines.map((line) => renderResultLine(task, line)).join('')}</tbody></table></div>
    ${paged.paginationHtml}
    ${canSubmit ? `<div class="flex flex-wrap items-end justify-end gap-3 border-t border-slate-100 px-5 py-4"><label class="text-sm text-slate-600">成果提交人<input aria-label="成果提交人" class="mt-1 block h-9 w-48 rounded-md border border-slate-200 px-3" value="${escapeHtml(getTaskUiValue(MODULE, task.taskId, '', 'submittedBy'))}" data-review-ui-field="submittedBy" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}"></label><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-review-ui-action="submit-pattern" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}">整单提交花型成果</button></div>` : ''}
  </section>`
}

function renderPatternReview(task: EngineeringTaskRecord): string {
  if (task.status !== '待审核') return ''
  const pendingLines = task.materialLines.filter((line) => line.status === '正常' && line.reviewStatus === '待审核')
  const paged = paginateTaskLines(MODULE, task.taskId, pendingLines)
  return `<section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><h2 class="text-base font-semibold text-slate-900">买手整单审核</h2><button type="button" class="h-9 rounded-md border border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-700" data-review-ui-action="pass-all-pattern" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}">一键全部通过</button></div>
    <div class="divide-y divide-slate-100">${paged.lines.map((line) => `<div class="grid gap-3 px-5 py-4 md:grid-cols-[1fr_160px_2fr]" data-review-row="${escapeHtml(line.materialLineId)}"><div><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-xs text-slate-500">${escapeHtml(line.materialSkuId)}</p></div><select aria-label="审核结论" class="h-9 rounded-md border border-slate-200 px-3 text-sm" data-review-ui-field="decision" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}"><option value="">请选择</option><option value="通过" ${getTaskUiValue(MODULE, task.taskId, line.materialLineId, 'decision') === '通过' ? 'selected' : ''}>通过</option><option value="未通过" ${getTaskUiValue(MODULE, task.taskId, line.materialLineId, 'decision') === '未通过' ? 'selected' : ''}>未通过</option></select><input aria-label="未通过原因" class="h-9 rounded-md border border-slate-200 px-3 text-sm" value="${inputValue(task, line, 'reason')}" data-review-ui-field="reason" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}" data-material-line-id="${escapeHtml(line.materialLineId)}" placeholder="未通过时必填"></div>`).join('')}</div>
    ${paged.paginationHtml}
    <div class="flex flex-wrap items-end justify-end gap-3 border-t border-slate-100 px-5 py-4"><label class="text-sm text-slate-600">买手审核人<input aria-label="买手审核人" class="mt-1 block h-9 w-48 rounded-md border border-slate-200 px-3" value="${escapeHtml(getTaskUiValue(MODULE, task.taskId, '', 'reviewerName'))}" data-review-ui-field="reviewerName" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}"></label><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-review-ui-action="review-pattern" data-review-ui-module="${MODULE}" data-task-id="${escapeHtml(task.taskId)}">确认整单审核</button></div>
  </section>`
}

export function renderPcsPatternTaskDetailPage(taskId: string): string {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail || detail.task.taskType !== 'PATTERN_ARTWORK') return renderEmptyDetail('花型任务', PATH)
  const { task, master } = detail
  return `<div class="space-y-5 p-4" data-engineering-review-detail="${MODULE}:${escapeHtml(task.taskId)}">
    ${renderHeaderMeta(`${task.taskName} · ${task.taskId}`, `${master.masterOrderCode} · ${master.styleCode} · ${master.styleName}`, renderStatusBadge(task.status), `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700" data-nav="${PATH}">返回列表</button>`)}
    <div data-review-ui-feedback role="alert" hidden></div>
    ${renderTaskSummaryCard(task, master)}${renderTaskMasterCard(master)}${renderPatternSubmission(task)}${renderPatternReview(task)}
    ${renderTaskReworkRoundsCard(task)}${renderTaskDependencyCard(task)}${renderTaskLogsCard(task, master, MODULE)}
  </div>`
}

function getTask(taskId: string): EngineeringTaskRecord {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail || detail.task.taskType !== 'PATTERN_ARTWORK') throw new Error('花型任务不存在。')
  return detail.task
}

export function handlePatternTaskInput(target: Element): boolean {
  return handleTaskUiInput(target, MODULE)
}

export function handlePatternTaskEvent(target: HTMLElement): boolean {
  const node = getTaskUiActionNode(target, MODULE)
  if (!node) return false
  const action = node.dataset.reviewUiAction || ''
  const taskId = node.dataset.taskId || ''
  const container = getTaskUiFeedbackContainer(node, `[data-engineering-review-detail="${MODULE}:${taskId}"]`)
  try {
    if (action === 'page') {
      changeTaskUiPage(MODULE, taskId, Number(node.dataset.page || 1))
      refreshTaskUiRegion(MODULE, taskId, renderPcsPatternTaskDetailPage)
      return true
    }
    const task = getTask(taskId)
    if (action === 'submit-pattern') {
      const lines = task.materialLines.filter((line) => line.status === '正常' && line.reviewStatus !== '通过' && (task.status !== '返工中' || line.reviewStatus === '未通过'))
      submitEngineeringMaterialResults({
        masterOrderId: task.masterOrderId,
        taskId,
        submittedBy: getTaskUiValue(MODULE, taskId, '', 'submittedBy'),
        results: lines.map((line) => ({
          materialLineId: line.materialLineId,
          resultFileIds: splitTaskUiReferences(getTaskUiValue(MODULE, taskId, line.materialLineId, 'resultFiles', line.resultFileIds.join(', '))),
          effectImageIds: splitTaskUiReferences(getTaskUiValue(MODULE, taskId, line.materialLineId, 'effectImages', line.effectImageIds.join(', '))),
        })),
      })
      refreshTaskUiRegion(MODULE, taskId, renderPcsPatternTaskDetailPage)
      return true
    }
    if (action === 'review-pattern' || action === 'pass-all-pattern') {
      const pendingLines = task.materialLines.filter((line) => line.status === '正常' && line.reviewStatus === '待审核')
      reviewEngineeringMaterialResults({
        masterOrderId: task.masterOrderId,
        taskId,
        reviewerName: getTaskUiValue(MODULE, taskId, '', 'reviewerName'),
        reviewerRole: '买手',
        decisions: pendingLines.map((line) => ({
          materialLineId: line.materialLineId,
          decision: action === 'pass-all-pattern' ? '通过' : getTaskUiValue(MODULE, taskId, line.materialLineId, 'decision') as '通过' | '未通过',
          reason: action === 'pass-all-pattern' ? '' : getTaskUiValue(MODULE, taskId, line.materialLineId, 'reason'),
        })),
      })
      refreshTaskUiRegion(MODULE, taskId, renderPcsPatternTaskDetailPage)
      return true
    }
  } catch (error) {
    setTaskUiFeedback(container, error instanceof Error ? error.message : '操作失败，请重试。')
    return true
  }
  return false
}

export const renderPcsPatternTaskPage = page.renderList
