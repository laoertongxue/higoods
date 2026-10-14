import type { ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { handlePmsCommonImageEvent, hydratePmsSurface, renderPmsImagePreview } from './shared.ts'

type LocalController = {
  refresh: (options?: { table?: boolean; pagination?: boolean; overlays?: boolean }) => boolean
  renderColumnSettings: () => string
  setPageSize: (value: number) => void
  stepPage: (delta: number) => void
  cycleSort: (key: string) => void
  updateColumnPreference: (action: string, key: string, checked?: boolean) => void
  restorePreferences: () => void
  installColumnDragEvents: () => void
}

/** Region updates for the small PMS lists; business actions stay in their page. */
export function createPmsLocalListInteractions(options: {
  prefix: string
  state: ProcessOrderListControllerState
  controller: LocalController
  filters: () => string
  stats: () => string
  feedback: () => string
  overlays: () => string
  listTitle: () => string
}) {
  const attr = (part: string) => `data-${options.prefix}-${part}`
  const root = () => typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[${attr('root')}]`)
  function replace(part: string, html: string): void {
    const surface = root()?.querySelector<HTMLElement>(`[${attr(part)}]`)
    if (!surface) return
    surface.innerHTML = html
    hydratePmsSurface(surface)
  }
  function overlays(): void {
    replace('overlays', options.overlays() + options.controller.renderColumnSettings() + renderPmsImagePreview())
  }
  function refresh(resetFilters = false, preserveOverlay = false): void {
    options.controller.refresh({ overlays: false })
    const title=root()?.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
    if(title) title.textContent=options.listTitle()
    if (resetFilters) replace('filters', options.filters())
    replace('stats', options.stats())
    replace('feedback', options.feedback())
    if (!preserveOverlay) overlays()
    else {
      const panel=root()?.querySelector('[role="dialog"] section')
      let error=panel?.querySelector<HTMLElement>('[data-pms-local-error]')
      if(panel && !error){error=document.createElement('div');error.dataset.pmsLocalError='';panel.prepend(error)}
      if(error) error.innerHTML=options.feedback()
    }
  }
  function handle(target: HTMLElement, event?: Event): boolean {
    if (!root()?.contains(target)) return false
    if (handlePmsCommonImageEvent(target, event, overlays)) return true
    const node = target.closest<HTMLElement>(`[${attr('action')}], [${attr('field')}]`)
    if (!node) return false
    const action = node.getAttribute(attr('action')) || ''
    const field = node.getAttribute(attr('field')) || ''
    if (field === 'pageSize') options.controller.setPageSize(Number((node as HTMLSelectElement).value))
    else if (action === 'prev-page' || action === 'next-page') options.controller.stepPage(action === 'next-page' ? 1 : -1)
    else if (action === 'sort-column') options.controller.cycleSort(node.dataset.columnKey || '')
    else if (action === 'open-column-settings' || action === 'close-column-settings') options.state.showColumnSettings = action === 'open-column-settings'
    else if (action === 'restore-column-settings') options.controller.restorePreferences()
    else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') options.controller.updateColumnPreference(action, node.closest<HTMLElement>(`[${attr('column-key')}]`)?.getAttribute(attr('column-key')) || '', (node as HTMLInputElement).checked)
    else return false
    refresh()
    return true
  }
  return { refresh, overlays, handle, mount: () => { options.controller.installColumnDragEvents(); hydratePmsSurface(root()) } }
}
