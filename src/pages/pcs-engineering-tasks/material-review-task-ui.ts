import type { EngineeringTaskMaterialLine } from '../../data/pcs-engineering-master-types.ts'

const PAGE_SIZE = 8
const draftValues = new Map<string, string>()
const currentPages = new Map<string, number>()

type ClosestCapable = {
  closest: (selector: string) => unknown
}

function isClosestCapable(value: unknown): value is ClosestCapable {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { closest?: unknown }).closest === 'function'
}

function isReviewUiDomNode(value: unknown): value is HTMLElement {
  if (!isClosestCapable(value)) return false
  const candidate = value as {
    dataset?: unknown
    querySelector?: unknown
    querySelectorAll?: unknown
  }
  return typeof candidate.dataset === 'object'
    && candidate.dataset !== null
    && typeof candidate.querySelector === 'function'
    && typeof candidate.querySelectorAll === 'function'
}

function isParentNodeLike(value: unknown): value is ParentNode {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { querySelector?: unknown }).querySelector === 'function'
    && typeof (value as { querySelectorAll?: unknown }).querySelectorAll === 'function'
}

export function getTaskUiActionNode(target: unknown, expectedModule: string): HTMLElement | null {
  if (!isClosestCapable(target)) return null
  const node = target.closest(`[data-review-ui-action][data-review-ui-module="${expectedModule}"]`)
  if (!isReviewUiDomNode(node)) return null
  if (node.dataset.reviewUiModule !== expectedModule || !node.dataset.reviewUiAction) return null
  return node
}

export function getTaskUiFeedbackContainer(node: HTMLElement, selector: string): ParentNode | null {
  const closestContainer = node.closest(selector)
  if (isParentNodeLike(closestContainer)) return closestContainer
  const fallback = typeof document === 'undefined' ? null : document
  return isParentNodeLike(fallback) ? fallback : null
}

function scopeKey(module: string, taskId: string): string {
  return `${module}:${taskId}`
}

function valueKey(module: string, taskId: string, lineId: string, field: string): string {
  return `${scopeKey(module, taskId)}:${lineId || '$task'}:${field}`
}

export function getTaskUiValue(
  module: string,
  taskId: string,
  lineId: string,
  field: string,
  fallback = '',
): string {
  return draftValues.get(valueKey(module, taskId, lineId, field)) ?? fallback
}

export function setTaskUiValue(module: string, taskId: string, lineId: string, field: string, value: string): void {
  draftValues.set(valueKey(module, taskId, lineId, field), value)
}

export function handleTaskUiInput(target: Element, expectedModule: string): boolean {
  const node = target.closest<HTMLInputElement | HTMLSelectElement>('[data-review-ui-field]')
  if (!node || node.dataset.reviewUiModule !== expectedModule) return false
  setTaskUiValue(
    expectedModule,
    node.dataset.taskId || '',
    node.dataset.materialLineId || '',
    node.dataset.reviewUiField || '',
    node.value,
  )
  return true
}

export function paginateTaskLines(
  module: string,
  taskId: string,
  lines: EngineeringTaskMaterialLine[],
): { lines: EngineeringTaskMaterialLine[]; paginationHtml: string } {
  const key = scopeKey(module, taskId)
  const totalPages = Math.max(1, Math.ceil(lines.length / PAGE_SIZE))
  const page = Math.min(currentPages.get(key) || 1, totalPages)
  currentPages.set(key, page)
  const start = (page - 1) * PAGE_SIZE
  return {
    lines: lines.slice(start, start + PAGE_SIZE),
    paginationHtml: `<div class="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      <span>共 ${lines.length} 条，第 ${page} / ${totalPages} 页，每页 ${PAGE_SIZE} 条</span>
      <div class="flex gap-2">
        <button type="button" class="h-8 rounded-md border border-slate-200 px-3 disabled:cursor-not-allowed disabled:opacity-40" data-review-ui-action="page" data-review-ui-module="${module}" data-task-id="${taskId}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="h-8 rounded-md border border-slate-200 px-3 disabled:cursor-not-allowed disabled:opacity-40" data-review-ui-action="page" data-review-ui-module="${module}" data-task-id="${taskId}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>`,
  }
}

export function changeTaskUiPage(module: string, taskId: string, page: number): void {
  currentPages.set(scopeKey(module, taskId), Math.max(1, page))
}

export function setTaskUiFeedback(container: ParentNode | null, message: string, tone: 'error' | 'success' = 'error'): void {
  if (!isParentNodeLike(container)) return
  const region = container.querySelector<HTMLElement>('[data-review-ui-feedback]')
  if (!region) return
  region.className = tone === 'error'
    ? 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
    : 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
  region.textContent = message
  region.hidden = false
}

export function refreshTaskUiRegion(
  module: string,
  taskId: string,
  renderDetail: (taskId: string) => string,
): void {
  const region = document.querySelector<HTMLElement>(`[data-engineering-review-detail="${module}:${taskId}"]`)
  if (region) region.outerHTML = renderDetail(taskId)
}

export function splitTaskUiReferences(value: string): string[] {
  return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean)
}
