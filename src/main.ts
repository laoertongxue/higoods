import './styles.css'
import { hydrateIcons, renderAppShell } from './components/shell'
import { appStore } from './state/store'
import {
  closeFcsDialogsOnEscape,
  dispatchFcsPageEvent,
  dispatchFcsPageSubmit,
} from './main-handlers/fcs-handlers'
import {
  closePcsDialogsOnEscape,
  dispatchPcsInputEvent,
  dispatchPcsPageEvent,
} from './main-handlers/pcs-handlers'
import {
  closePdaDialogsOnEscape,
  dispatchPdaPageEvent,
} from './main-handlers/pda-handlers'

const rootNode = document.querySelector('#app')

if (!(rootNode instanceof HTMLDivElement)) {
  throw new Error('Missing #app root node')
}

const root = rootNode

appStore.init()

function dispatchPageEvent(target: Element): boolean {
  const eventTarget = target as HTMLElement
  return (
    dispatchFcsPageEvent(eventTarget) ||
    dispatchPcsPageEvent(eventTarget) ||
    dispatchPdaPageEvent(eventTarget)
  )
}

function dispatchPageSubmit(form: HTMLFormElement): boolean {
  return dispatchFcsPageSubmit(form)
}

function render(): void {
  root.innerHTML = renderAppShell(appStore.getState())
  hydrateIcons(root)
}

function closeMobileSidebar(): void {
  const { sidebarOpen } = appStore.getState()
  if (sidebarOpen) {
    appStore.setSidebarOpen(false)
  }
}

function hasDatasetAction(node: HTMLElement): boolean {
  return Object.keys(node.dataset).some((key) => key === 'action' || key.endsWith('Action'))
}

function hasDatasetFieldLike(node: HTMLElement): boolean {
  return Object.keys(node.dataset).some(
    (key) => key === 'field' || key === 'filter' || key.endsWith('Field') || key.endsWith('Filter'),
  )
}

function shouldBypassClickDispatch(target: Element): boolean {
  const controlNode = target.closest<HTMLElement>('input, textarea, select, option')
  if (!controlNode) return false

  const actionBound = hasDatasetAction(controlNode)

  // Let native select keep its default open/select behavior.
  if (controlNode instanceof HTMLSelectElement || controlNode instanceof HTMLOptionElement) return true
  if (controlNode.closest('select') instanceof HTMLSelectElement) return true

  if (controlNode instanceof HTMLTextAreaElement && !actionBound) return true

  if (controlNode instanceof HTMLInputElement) {
    const inputType = (controlNode.type || 'text').toLowerCase()
    const clickDrivenTypes = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color'])
    if (!clickDrivenTypes.has(inputType) && !actionBound) return true
  }

  // Field/filter controls are synced by global input/change listeners.
  // Avoid click-triggered full rerender that causes flicker and focus loss.
  if (hasDatasetFieldLike(controlNode) && !actionBound) return true

  return false
}

function resolveEventElementTarget(eventTarget: EventTarget | null): Element | null {
  if (eventTarget instanceof Element) return eventTarget
  if (eventTarget instanceof Node) return eventTarget.parentElement
  return null
}

root.addEventListener('click', (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return

  if (shouldBypassClickDispatch(target)) return

  if (dispatchPageEvent(target)) {
    event.preventDefault()
    render()
    return
  }

  const navNode = target.closest<HTMLElement>('[data-nav]')
  if (navNode?.dataset.nav) {
    event.preventDefault()
    appStore.navigate(navNode.dataset.nav)
    closeMobileSidebar()
    return
  }

  const actionNode = target.closest<HTMLElement>('[data-action]')
  if (!actionNode) return

  const action = actionNode.dataset.action
  if (!action) return

  event.preventDefault()

  if (action === 'switch-system') {
    const systemId = actionNode.dataset.systemId
    if (systemId) {
      appStore.switchSystem(systemId)
      closeMobileSidebar()
    }
    return
  }

  if (action === 'set-sidebar-open') {
    appStore.setSidebarOpen(actionNode.dataset.sidebarOpen === 'true')
    return
  }

  if (action === 'toggle-sidebar-collapsed') {
    appStore.toggleSidebarCollapsed()
    return
  }

  if (action === 'toggle-menu-group') {
    const groupKey = actionNode.dataset.groupKey
    if (groupKey) appStore.toggleGroup(groupKey)
    return
  }

  if (action === 'toggle-menu-item') {
    const itemKey = actionNode.dataset.itemKey
    if (itemKey) appStore.toggleItem(itemKey)
    return
  }

  if (action === 'open-tab') {
    const href = actionNode.dataset.tabHref
    const key = actionNode.dataset.tabKey
    const title = actionNode.dataset.tabTitle

    if (href && key && title) {
      appStore.openTab({
        href,
        key,
        title,
        closable: true,
      })
      closeMobileSidebar()
    }
    return
  }

  if (action === 'activate-tab') {
    const key = actionNode.dataset.tabKey
    if (key) appStore.activateTab(key)
    return
  }

  if (action === 'close-tab') {
    const key = actionNode.dataset.tabKey
    if (key) appStore.closeTab(key)
    return
  }
})

root.addEventListener('input', (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return

  if (dispatchPcsInputEvent(target)) {
    render()
    return
  }

  if (dispatchPageEvent(target)) {
    render()
  }
})

root.addEventListener('change', (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return

  if (dispatchPageEvent(target)) {
    render()
  }
})

root.addEventListener('submit', (event) => {
  const target = event.target
  if (!(target instanceof HTMLFormElement)) return

  if (dispatchPageSubmit(target)) {
    event.preventDefault()
    render()
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return

  if (closeFcsDialogsOnEscape() || closePcsDialogsOnEscape() || closePdaDialogsOnEscape()) {
    render()
    return
  }

  if (appStore.getState().sidebarOpen) {
    appStore.setSidebarOpen(false)
  }
})

appStore.subscribe(render)
render()
