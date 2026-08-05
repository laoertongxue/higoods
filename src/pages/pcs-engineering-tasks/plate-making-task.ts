// @page-pattern: list
// 标准列表契约由 createMasterTaskPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 制版任务：列表使用标准任务页；详情维护基码／齐码纸样的独立成果版本。
import {
  listEngineeringPatternResultVersions,
  submitEngineeringPatternResult,
} from '../../data/pcs-engineering-pattern-result'
import { escapeHtml } from '../../utils'
import {
  getEngineeringTaskDetail,
  renderTaskDependencyCard,
  renderTaskLogsCard,
  renderTaskReworkRoundsCard,
  renderTaskWorkbenchHeader,
} from './master-task-common'
import { createMasterTaskPage } from './master-task-page'
import { renderEmptyDetail, state } from './shared'

const PATH = '/pcs/patterns/plate-making'
const TASK_TYPES = ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'] as const
const drafts = new Map<string, Record<string, string>>()

const page = createMasterTaskPage({
  module: 'plate', title: '制版任务', path: PATH,
  taskTypes: TASK_TYPES,
  listState: state.plateList,
})

function draftValue(taskId: string, field: string): string {
  return drafts.get(taskId)?.[field] || ''
}

function renderFiles(label: string, values: string[]): string {
  return `<div><p class="text-xs text-slate-500">${escapeHtml(label)}</p><p class="mt-1 break-all text-sm text-slate-700">${escapeHtml(values.join('、') || '-')}</p></div>`
}

function renderVersions(taskId: string): string {
  const versions = listEngineeringPatternResultVersions(taskId)
  if (versions.length === 0) return '<p class="px-5 py-8 text-center text-sm text-slate-500">尚未提交纸样成果</p>'
  return `<div class="divide-y divide-slate-100">${versions.map((version) => `<article class="p-5">
    <div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-medium text-slate-900">${escapeHtml(version.versionLabel)} · ${escapeHtml(version.patternKind)} · ${escapeHtml(version.materialKind)}</h3><p class="mt-1 text-xs text-slate-500">${escapeHtml(version.submittedBy)} · ${escapeHtml(version.submittedAt)}${version.replacedVersionId ? ` · 替换 ${escapeHtml(version.replacedVersionId)}` : ''}</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">适用尺码 ${escapeHtml(version.applicableSizes.join(' / '))}</span></div>
    <div class="mt-4 grid gap-4 md:grid-cols-4">${renderFiles('PDF', version.pdfFiles)}${renderFiles('DXF', version.dxfFiles)}${renderFiles('RUL', version.rulFiles)}${renderFiles('说明', version.note ? [version.note] : [])}</div>
    ${version.imageUrls.length ? `<div class="mt-4 grid gap-3 sm:grid-cols-4">${version.imageUrls.map((url, index) => `<button type="button" class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50" data-plate-action="preview-image" data-image-url="${escapeHtml(url)}" data-image-alt="${escapeHtml(`${version.versionLabel} 纸样图 ${index + 1}`)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(`${version.versionLabel} 纸样图 ${index + 1}`)}" class="h-32 w-full object-contain" loading="lazy"><span class="block px-2 py-1 text-xs text-slate-500">查看大图</span></button>`).join('')}</div>` : ''}
  </article>`).join('')}</div>`
}

function renderResultEditor(taskId: string, status: string): string {
  if (!['进行中', '已完成', '返工中'].includes(status)) return ''
  const replaceMode = status === '已完成'
  return `<section class="rounded-lg border border-slate-200 bg-white" data-plate-form="${escapeHtml(taskId)}">
    <div class="border-b border-slate-100 px-5 py-4"><h2 class="font-semibold text-slate-900">${replaceMode ? '提交替换版本' : '提交纸样成果'}</h2><p class="mt-1 text-xs text-slate-500">替换只新增版本，旧版本继续保留。</p></div>
    <div data-plate-feedback class="mx-5 mt-4 hidden rounded-md px-3 py-2 text-sm" role="alert"></div>
    <div class="grid gap-4 p-5 md:grid-cols-2">
      ${[['sizes','适用尺码','S, M, L'],['images','纸样图片','多个用逗号分隔'],['pdf','PDF 文件','多个用逗号分隔'],['dxf','DXF 文件','多个用逗号分隔'],['rul','RUL 文件','多个用逗号分隔']].map(([field,label,placeholder]) => `<label class="text-sm text-slate-600">${label}<input class="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" value="${escapeHtml(draftValue(taskId, field))}" data-plate-field="${field}" data-task-id="${escapeHtml(taskId)}" placeholder="${placeholder}"></label>`).join('')}
      <label class="text-sm text-slate-600 md:col-span-2">成果说明<textarea class="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" data-plate-field="note" data-task-id="${escapeHtml(taskId)}">${escapeHtml(draftValue(taskId, 'note'))}</textarea></label>
    </div>
    <div class="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-plate-action="submit-result" data-task-id="${escapeHtml(taskId)}">${replaceMode ? '保存新版本' : '提交并完成任务'}</button></div>
  </section>`
}

export const renderPcsPlateMakingTaskPage = page.renderList

export function renderPcsPlateMakingTaskDetailPage(taskId: string): string {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail || !TASK_TYPES.includes(detail.task.taskType as typeof TASK_TYPES[number])) return renderEmptyDetail('制版任务', PATH)
  const { task, master } = detail
  return `<div class="space-y-5 p-4" data-plate-detail="${escapeHtml(task.taskId)}" data-engineering-task-detail="plate:${escapeHtml(task.taskId)}">
    ${renderTaskWorkbenchHeader(task, master, 'plate', PATH)}
    <section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-4"><h2 class="font-semibold text-slate-900">成果版本</h2></div>${renderVersions(task.taskId)}</section>
    ${renderResultEditor(task.taskId, task.status)}${renderTaskReworkRoundsCard(task)}${renderTaskDependencyCard(task)}${renderTaskLogsCard(task, master, 'plate')}
  </div>`
}

export function handlePlateMakingTaskInput(target: Element): boolean {
  const node = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-plate-field]')
  if (!node) return false
  const taskId = node.dataset.taskId || ''
  const current = drafts.get(taskId) || {}
  current[node.dataset.plateField || ''] = node.value
  drafts.set(taskId, current)
  return true
}

function split(value: string): string[] {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
}

export function handlePlateMakingTaskEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-plate-action]')
  if (!node) return false
  if (node.dataset.plateAction === 'preview-image') {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6'
    overlay.dataset.platePreview = 'true'
    overlay.innerHTML = `<button type="button" aria-label="关闭大图" class="absolute right-6 top-6 rounded-full bg-white px-3 py-2 text-slate-800" data-plate-action="close-preview">关闭</button><img src="${escapeHtml(node.dataset.imageUrl || '')}" alt="${escapeHtml(node.dataset.imageAlt || '纸样大图')}" class="max-h-full max-w-full object-contain">`
    document.body.appendChild(overlay)
    return true
  }
  if (node.dataset.plateAction === 'close-preview') {
    node.closest<HTMLElement>('[data-plate-preview]')?.remove()
    return true
  }
  if (node.dataset.plateAction !== 'submit-result') return false
  const taskId = node.dataset.taskId || ''
  const detail = getEngineeringTaskDetail(taskId)
  const feedback = document.querySelector<HTMLElement>(`[data-plate-form="${CSS.escape(taskId)}"] [data-plate-feedback]`)
  try {
    if (!detail) throw new Error('未找到制版任务。')
    const current = drafts.get(taskId) || {}
    submitEngineeringPatternResult({
      masterOrderId: detail.master.masterOrderId,
      taskId,
      applicableSizes: split(current.sizes || ''),
      imageUrls: split(current.images || ''),
      pdfFiles: split(current.pdf || ''),
      dxfFiles: split(current.dxf || ''),
      rulFiles: split(current.rul || ''),
      note: current.note || '',
      submittedBy: detail.task.assigneeName || detail.task.ownerTeamName,
    })
    drafts.delete(taskId)
    const host = document.querySelector<HTMLElement>(`[data-plate-detail="${CSS.escape(taskId)}"]`)
    if (host) host.outerHTML = renderPcsPlateMakingTaskDetailPage(taskId)
    return true
  } catch (error) {
    if (feedback) {
      feedback.hidden = false
      feedback.className = 'mx-5 mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'
      feedback.textContent = error instanceof Error ? error.message : '提交失败，请重试。'
    }
    return true
  }
}

export function isPlateMakingTaskDialogOpen(): boolean {
  return Boolean(document.querySelector('[data-plate-preview]'))
}
