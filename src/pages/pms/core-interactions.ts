import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface } from './shared.ts'
import type { ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'

/** Small DOM helpers shared only by the five procurement pages in this work package. */
export function refreshPmsCoreRegion(root: HTMLElement | null, selector: string, html: string): void {
  const region = root?.querySelector<HTMLElement>(selector)
  if (!region) return
  region.innerHTML = html
  hydratePmsSurface(region)
}

export function refreshPmsCoreOverlay(root: HTMLElement | null, selector: string, html: string, operationId: string, pending = false): void {
  const region = root?.querySelector<HTMLElement>(selector)
  if (!region) return
  const sameDraft = Boolean(operationId) && region.dataset.operationId === operationId
  const keyFor = (input: Element, index: number): string => `${input.tagName}:${input.getAttribute('type') ?? ''}:${input.getAttribute('name') ?? ''}:${[...input.attributes].filter(attribute => attribute.name.startsWith('data-') && !['data-pms-event-handled-locally','data-preserve-native-click','data-skip-page-rerender'].includes(attribute.name)).map(attribute => `${attribute.name}=${attribute.value}`).join('|') || index}`
  const values = new Map(sameDraft ? [...region.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')]
    .map((input, index) => [keyFor(input, index), { tag: input.tagName, value: input.value, checked: input instanceof HTMLInputElement ? input.checked : false }] as const) : [])
  region.innerHTML = html
  region.dataset.operationId = operationId
  if (sameDraft) [...region.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')].forEach((input, index) => {
    const previous = values.get(keyFor(input, index))
    if (!previous || previous.tag !== input.tagName || input instanceof HTMLInputElement && input.type === 'file') return
    input.value = previous.value
    if (input instanceof HTMLInputElement && ['checkbox', 'radio'].includes(input.type)) input.checked = previous.checked
  })
  region.querySelectorAll<HTMLButtonElement>('button').forEach(button => { if (pending) button.disabled = true })
  hydratePmsSurface(region)
}

export function setPmsCoreSavePending(root: HTMLElement | null, pending: boolean): void {
  root?.querySelectorAll<HTMLButtonElement>('[role="dialog"] button').forEach(button => { button.disabled = pending })
}

interface CoreListController {
  refresh(options?: { table?: boolean; pagination?: boolean; overlays?: boolean }): boolean
  stepPage(delta: number): void
  setPageSize(value: number): void
  cycleSort(key: string): void
  restorePreferences(): void
  updateColumnPreference(action: string, key: string, desired?: boolean): void
}

export function handlePmsCoreListControls(target: HTMLElement, prefix: string, state: ProcessOrderListControllerState, controller: CoreListController, refreshOverlay: () => void): boolean {
  const ensureCoreJump = () => { const root = document.querySelector(`[data-${prefix}-root]`); const region = root?.querySelector(`[data-${prefix}-pagination-surface]`); if (region && !region.querySelector(`[data-${prefix}-field="pageJump"]`)) region.insertAdjacentHTML('beforeend', renderPmsCorePagination('', prefix, state.currentPage)) }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${prefix}-field]`)
  const fieldName = field?.getAttribute(`data-${prefix}-field`)
  if (fieldName === 'pageSize') { controller.setPageSize(Number(field?.value)); controller.refresh({ overlays: false }); ensureCoreJump(); return true }
  if (fieldName === 'pageJump') {
    state.currentPage = Math.max(1, Math.floor(Number(field?.value) || 1))
    return true
  }
  const node = target.closest<HTMLElement>(`[data-${prefix}-action]`)
  const action = node?.getAttribute(`data-${prefix}-action`)
  if (!action) return false
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1); controller.refresh({ overlays: false }); ensureCoreJump(); return true
  }
  if (action === 'jump-page' || action === 'go-page') {
    const input = node?.closest('[data-table-pagination]')?.querySelector<HTMLInputElement>(`[data-${prefix}-field="pageJump"]`)
      || document.querySelector<HTMLInputElement>(`[data-${prefix}-field="pageJump"]`)
    state.currentPage = Math.max(1, Math.floor(Number(input?.value) || state.currentPage))
    controller.refresh({ overlays: false }); ensureCoreJump(); return true
  }
  if (action === 'sort-column') { controller.cycleSort(node?.dataset.columnKey || ''); controller.refresh({ overlays: false }); ensureCoreJump(); return true }
  if (action === 'open-column-settings' || action === 'close-column-settings') { state.showColumnSettings = action === 'open-column-settings'; refreshOverlay(); return true }
  if (action === 'restore-column-settings') { controller.restorePreferences(); controller.refresh({ overlays: false }); refreshOverlay(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = node?.closest<HTMLElement>(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`) || ''
    controller.updateColumnPreference(action, key, node instanceof HTMLInputElement ? node.checked : undefined)
    controller.refresh({ overlays: false }); refreshOverlay(); return true
  }
  return false
}

export function renderPmsCorePagination(html: string, prefix: string, page: number): string {
  return `${html}<div class="mt-2 flex items-center justify-end gap-2"><label class="text-xs text-muted-foreground">跳转到 <input type="number" min="1" value="${page}" class="h-8 w-16 rounded border px-2" data-${prefix}-field="pageJump" aria-label="跳转页码" /></label><button type="button" class="h-8 rounded border px-3 text-xs" data-${prefix}-action="jump-page">跳转</button></div>`
}
export function renderPmsCoreMulti(prefix: string, key: string, label: string, candidates: string[], selected: string[]): string {
  return `<details class="relative rounded border bg-background"><summary class="cursor-pointer px-3 py-2 text-sm">${escapeHtml(label)} · ${selected.length ? `已选${selected.length}` : '全部'}</summary><div class="absolute z-30 max-h-64 min-w-52 overflow-auto rounded border bg-white p-3 shadow-lg"><div class="mb-2 flex gap-3"><button type="button" class="text-xs text-blue-700" data-${prefix}-action="multi-all" data-multi-key="${key}">全选</button><button type="button" class="text-xs text-blue-700" data-${prefix}-action="multi-clear" data-multi-key="${key}">清空</button></div>${candidates.map(value => `<label class="mb-2 flex gap-2 text-sm"><input type="checkbox" data-preserve-native-click="true" data-${prefix}-multi="${key}" value="${escapeHtml(value)}" ${selected.includes(value) ? 'checked' : ''} />${escapeHtml(value)}</label>`).join('') || '<p class="text-sm text-muted-foreground">暂无候选</p>'}</div></details>`
}
