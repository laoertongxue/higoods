// 工程专业任务入口：只负责路由兼容和列表轻交互；任务事实由各专业页或工程主单读取。

import { resetRevisionTaskRepository } from '../data/pcs-revision-task-repository.ts'
import { clearListColumnPreferences } from '../components/ui/list-table-model.ts'
import { escapeHtml } from '../utils.ts'
import {
  ENGINEERING_LIST_PAGE_SIZES,
  ENGINEERING_LIST_STORAGE_KEYS,
  clearNotice,
  engineeringListUiState,
  getEngineeringListColumns,
  getEngineeringListModule,
  getEngineeringListRows,
  getEngineeringListState,
  getEngineeringListStorage,
  normalizeEngineeringListPreferences,
  refreshEngineeringColumnOverlay,
  refreshEngineeringList,
  saveEngineeringListPreferences,
  setNotice,
  state,
} from './pcs-engineering-tasks/shared.ts'
import {
  handleRevisionTaskEvent,
  handleRevisionTaskInput,
  isRevisionTaskDialogOpen,
  renderPcsRevisionTaskDetailPage,
  renderPcsRevisionTaskPage,
  resetRevisionTaskPageState,
} from './pcs-engineering-tasks/revision-task.ts'
import {
  handleFirstSampleTaskEvent,
  handleFirstSampleTaskInput,
  renderPcsFirstSampleTaskDetailPage,
  renderPcsFirstSampleTaskPage,
} from './pcs-engineering-tasks/first-sample-task.ts'
import { handlePlateMakingTaskEvent, handlePlateMakingTaskInput, renderPcsPlateMakingTaskDetailPage } from './pcs-engineering-tasks/plate-making-task.ts'
import { handlePatternTaskEvent, handlePatternTaskInput, renderPcsPatternTaskDetailPage } from './pcs-engineering-tasks/pattern-task.ts'
import { handleColorTaskEvent, handleColorTaskInput, renderPcsColorTaskDetailPage } from './pcs-engineering-tasks/color-task.ts'
import { handlePurchaseTaskEvent, renderPcsPurchaseTaskDetailPage } from './pcs-engineering-tasks/purchase-task.ts'
import { handleTechPackTaskEvent, handleTechPackTaskInput, renderPcsTechPackTaskDetailPage } from './pcs-engineering-tasks/tech-pack-task.ts'
import { startEngineeringTaskFromDetail } from './pcs-engineering-tasks/master-task-common.ts'

export { renderPcsRevisionTaskDetailPage, renderPcsRevisionTaskPage } from './pcs-engineering-tasks/revision-task.ts'
export { renderPcsPlateMakingTaskDetailPage, renderPcsPlateMakingTaskPage } from './pcs-engineering-tasks/plate-making-task.ts'
export { renderPcsPatternTaskDetailPage, renderPcsPatternTaskPage } from './pcs-engineering-tasks/pattern-task.ts'
export {
  submitEngineeringFirstSampleResult,
} from './pcs-engineering-tasks/first-sample-task.ts'
export { renderPcsFirstSampleTaskDetailPage, renderPcsFirstSampleTaskPage }
export { renderPcsColorTaskDetailPage, renderPcsColorTaskPage } from './pcs-engineering-tasks/color-task.ts'
export { renderPcsPurchaseTaskDetailPage, renderPcsPurchaseTaskPage } from './pcs-engineering-tasks/purchase-task.ts'
export { renderPcsTechPackTaskDetailPage, renderPcsTechPackTaskPage } from './pcs-engineering-tasks/tech-pack-task.ts'

const engineeringTaskDetailRenderers = {
  plate: renderPcsPlateMakingTaskDetailPage,
  pattern: renderPcsPatternTaskDetailPage,
  color: renderPcsColorTaskDetailPage,
  purchase: renderPcsPurchaseTaskDetailPage,
  techPack: renderPcsTechPackTaskDetailPage,
  firstSample: renderPcsFirstSampleTaskDetailPage,
} as const

function handleEngineeringTaskWorkbenchAction(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-engineering-task-action]')
  if (!node) return false
  const action = node.dataset.engineeringTaskAction || ''
  if (action === 'preview-image') {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-6'
    overlay.dataset.engineeringTaskImagePreview = 'true'
    const imageTitle = node.dataset.imageTitle || '图片预览'
    overlay.innerHTML = `<button type="button" class="absolute inset-0 bg-slate-950/70" data-engineering-task-action="close-preview" aria-label="关闭大图预览"></button><section class="relative z-10 flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"><header class="flex items-center justify-between border-b px-5 py-3"><h2 class="font-semibold text-slate-900">${escapeHtml(imageTitle)}</h2><button type="button" class="h-8 w-8 rounded-md border" data-engineering-task-action="close-preview" aria-label="关闭大图预览">×</button></header><div class="overflow-auto bg-slate-100 p-5"><img src="${escapeHtml(node.dataset.imageUrl || '')}" alt="${escapeHtml(imageTitle)}" class="mx-auto max-h-[80vh] max-w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="p-12 text-sm text-rose-700">图片加载失败，请检查原图地址。</p></div></section>`
    document.body.appendChild(overlay)
    return true
  }
  if (action === 'close-preview') {
    document.querySelector('[data-engineering-task-image-preview]')?.remove()
    return true
  }
  if (action !== 'start') return false
  const taskId = node.dataset.taskId || ''
  const module = node.dataset.module as keyof typeof engineeringTaskDetailRenderers
  const feedback = node.closest<HTMLElement>('[data-engineering-task-workbench]')?.querySelector<HTMLElement>('[data-engineering-task-feedback]')
  try {
    const renderer = engineeringTaskDetailRenderers[module]
    if (!renderer) throw new Error('未找到当前任务页面。')
    startEngineeringTaskFromDetail(taskId)
    const host = document.querySelector<HTMLElement>(`[data-engineering-task-detail="${CSS.escape(`${module}:${taskId}`)}"]`)
    if (host) host.outerHTML = renderer(taskId)
    return true
  } catch (error) {
    if (feedback) {
      feedback.hidden = false
      feedback.className = 'mx-5 mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'
      feedback.textContent = error instanceof Error ? error.message : '任务开始失败，请重试。'
    }
    return true
  }
}

// 仅为旧路由渲染器保留函数名；页面和文案均统一为产前版样衣。
export const renderPcsFirstOrderSampleTaskPage = renderPcsFirstSampleTaskPage
export const renderPcsFirstOrderSampleTaskDetailPage = renderPcsFirstSampleTaskDetailPage

type ListModule = ReturnType<typeof getEngineeringListModule>

function refresh(module: NonNullable<ListModule>, withStats = false): void {
  getEngineeringListState(module).currentPage = 1
  refreshEngineeringList(module, withStats)
}

function handleListInput(target: Element): boolean {
  const node = target.closest<HTMLElement>('[data-pcs-engineering-field]')
  if (!node) return false
  const field = node.dataset.pcsEngineeringField || ''
  const module = getEngineeringListModule(node)
  if (!module) return false
  if (field === 'pageSize' && node instanceof HTMLSelectElement) {
    const columns = getEngineeringListColumns(module)
    engineeringListUiState[module].columnPreferences = normalizeEngineeringListPreferences(module, columns, {
      ...engineeringListUiState[module].columnPreferences,
      pageSize: Number(node.value),
    })
    refresh(module)
    saveEngineeringListPreferences(module)
    return true
  }
  const prefix = module === 'techPack' ? 'tech-pack' : module.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement) || !field.startsWith(`${prefix}-`)) return false
  const key = field.slice(prefix.length + 1) as 'search' | 'status' | 'owner' | 'source' | 'site'
  if (!['search', 'status', 'owner', 'source', 'site'].includes(key)) return false
  ;(state[`${module}List`] as Record<string, string>)[key] = node.value
  refresh(module)
  return true
}

function handleListDrag(module: NonNullable<ListModule>, target: HTMLElement, event?: Event): boolean {
  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (!dragNode || !event || !['dragstart', 'dragover', 'drop', 'dragend'].includes(event.type)) return false
  const ui = engineeringListUiState[module]
  const key = dragNode.dataset.pcsEngineeringColumnKey || dragNode.dataset.dragSource || dragNode.dataset.dropTarget || ''
  if (event.type === 'dragstart') {
    ui.draggedColumnKey = key
    ;(event as DragEvent).dataTransfer?.setData('application/x-higood-list-column-key', key)
    return Boolean(key)
  }
  if (event.type === 'dragend') { ui.draggedColumnKey = ''; return true }
  if (event.type === 'dragover') { event.preventDefault(); return true }
  event.preventDefault()
  const source = ui.draggedColumnKey
  if (!source || !key || source === key) return false
  const order = ui.columnPreferences.order.filter((item) => item !== source)
  const targetIndex = order.indexOf(key)
  if (targetIndex < 0) return false
  order.splice(targetIndex, 0, source)
  ui.columnPreferences = normalizeEngineeringListPreferences(module, getEngineeringListColumns(module), { ...ui.columnPreferences, order })
  ui.draggedColumnKey = ''
  saveEngineeringListPreferences(module)
  refreshEngineeringList(module)
  refreshEngineeringColumnOverlay(module)
  return true
}

function handleListAction(module: NonNullable<ListModule>, action: string, node: HTMLElement, event?: Event): boolean {
  const ui = engineeringListUiState[module]
  const columns = getEngineeringListColumns(module)
  if (action === 'sort-column') {
    const key = node.dataset.columnKey || ''
    const column = columns.find((item) => item.key === key && item.sortable)
    if (!column) return true
    ui.sort = ui.sort?.key !== key ? { key, direction: 'asc' } : ui.sort.direction === 'asc' ? { key, direction: 'desc' } : null
    refresh(module)
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    const listState = getEngineeringListState(module)
    const totalPages = Math.max(1, Math.ceil(getEngineeringListRows(module).length / ui.columnPreferences.pageSize))
    listState.currentPage = action === 'prev-page' ? Math.max(1, listState.currentPage - 1) : Math.min(totalPages, listState.currentPage + 1)
    refreshEngineeringList(module)
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    ui.columnSettingsOpen = action === 'open-column-settings'
    refreshEngineeringColumnOverlay(module)
    return true
  }
  if (action === 'restore-column-settings') {
    ui.columnPreferences = normalizeEngineeringListPreferences(module, columns, {
      order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: [], pageSize: ENGINEERING_LIST_PAGE_SIZES[0],
    })
    ui.sort = null
    const storage = getEngineeringListStorage()
    if (storage) clearListColumnPreferences(storage, ENGINEERING_LIST_STORAGE_KEYS[module])
    refresh(module)
    refreshEngineeringColumnOverlay(module)
    return true
  }
  if ((action === 'toggle-column-visibility' || action === 'toggle-column-freeze') && (!event || event.type === 'change')) {
    const key = node.dataset.pcsEngineeringColumnKey || node.dataset.columnKey || ''
    const column = columns.find((item) => item.key === key)
    if (!column || column.actionColumn) return true
    const visible = new Set(ui.columnPreferences.visibleKeys)
    const frozen = new Set(ui.columnPreferences.frozenKeys)
    if (action === 'toggle-column-visibility' && !column.required) visible.has(key) ? (visible.delete(key), frozen.delete(key)) : visible.add(key)
    if (action === 'toggle-column-freeze' && column.freezeable) frozen.has(key) ? frozen.delete(key) : frozen.add(key)
    ui.columnPreferences = normalizeEngineeringListPreferences(module, columns, { ...ui.columnPreferences, visibleKeys: [...visible], frozenKeys: [...frozen] })
    saveEngineeringListPreferences(module)
    refreshEngineeringList(module)
    refreshEngineeringColumnOverlay(module)
    return true
  }
  const prefix = module === 'techPack' ? 'tech-pack' : module.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  if (action === `set-${prefix}-quick-filter`) {
    ;(state[`${module}List`] as Record<string, string>).quickFilter = node.dataset.quickFilter || 'all'
    refresh(module, true)
    return true
  }
  return false
}

export function handlePcsEngineeringTaskInput(target: Element): boolean {
  return handlePatternTaskInput(target)
    || handleColorTaskInput(target)
    || handlePlateMakingTaskInput(target)
    || handleFirstSampleTaskInput(target)
    || handleTechPackTaskInput(target)
    || handleRevisionTaskInput(target)
    || handleListInput(target)
}

export function handlePcsEngineeringTaskEvent(target: HTMLElement, event?: Event): boolean {
  if (
    handleEngineeringTaskWorkbenchAction(target)
    ||
    handlePatternTaskEvent(target)
    || handleColorTaskEvent(target)
    || handlePlateMakingTaskEvent(target)
    || handleFirstSampleTaskEvent(target)
    || handleTechPackTaskEvent(target)
    || handlePurchaseTaskEvent(target, event)
  ) return true
  const module = getEngineeringListModule(target)
  if (module && handleListDrag(module, target, event)) return true
  const node = target.closest<HTMLElement>('[data-pcs-engineering-action]')
  if (!node) return false
  const action = node.dataset.pcsEngineeringAction || ''
  if (module && handleListAction(module, action, node, event)) return true
  if (action === 'close-notice') { clearNotice(); return true }
  if (action === 'refresh-page') { setNotice('已刷新当前任务页面。'); return true }
  if (action === 'close-all-engineering-dialogs') { resetRevisionTaskPageState(); document.querySelector('[data-engineering-task-image-preview]')?.remove(); return true }
  return handleRevisionTaskEvent(node)
}

export function isPcsEngineeringTaskDialogOpen(): boolean {
  return isRevisionTaskDialogOpen() || Boolean(document.querySelector('[data-engineering-task-image-preview]'))
}

export function resetPcsEngineeringTaskState(): void {
  clearNotice()
  resetRevisionTaskPageState()
  for (const module of ['revision', 'plate', 'pattern', 'color', 'purchase', 'techPack', 'firstSample'] as const) {
    const list = state[`${module}List`] as Record<string, string | number>
    Object.assign(list, { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 })
  }
}

export function resetPcsEngineeringTaskRepositories(): void {
  resetRevisionTaskRepository()
}
