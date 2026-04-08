import './styles.css'
import { hydrateRealQRCodes } from './components/real-qr'
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
  hydrateRealQRCodes(root)
}

interface FocusSnapshot {
  selector: string | null
  path: number[]
  selectionStart: number | null
  selectionEnd: number | null
  scrollTop: number | null
}

function escapeCssValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

function datasetKeyToAttribute(key: string): string {
  return `data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
}

function isFocusableField(
  element: Element | null,
): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  )
}

function buildFocusSelector(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | null {
  const tagName = element.tagName.toLowerCase()

  if (element.id) {
    return `${tagName}#${escapeCssValue(element.id)}`
  }

  const selectorParts: string[] = []
  const datasetEntries = Object.entries(element.dataset)

  for (const [key, value] of datasetEntries) {
    selectorParts.push(`[${datasetKeyToAttribute(key)}="${escapeCssValue(value)}"]`)
  }

  const name = element.getAttribute('name')
  if (name) {
    selectorParts.push(`[name="${escapeCssValue(name)}"]`)
  }

  if (element instanceof HTMLInputElement && element.type) {
    selectorParts.push(`[type="${escapeCssValue(element.type)}"]`)
  }

  return selectorParts.length > 0 ? `${tagName}${selectorParts.join('')}` : null
}

function buildFocusPath(element: Element): number[] {
  const path: number[] = []
  let current: Element | null = element

  while (current && current !== root) {
    const parent = current.parentElement
    if (!parent) break
    const index = Array.prototype.indexOf.call(parent.children, current)
    path.unshift(index)
    current = parent
  }

  return path
}

function captureFocusSnapshot(): FocusSnapshot | null {
  const activeElement = document.activeElement
  if (!isFocusableField(activeElement) || !root.contains(activeElement)) return null
  if (activeElement instanceof HTMLInputElement && activeElement.type === 'file') return null

  return {
    selector: buildFocusSelector(activeElement),
    path: buildFocusPath(activeElement),
    selectionStart:
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
        ? activeElement.selectionStart
        : null,
    selectionEnd:
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
        ? activeElement.selectionEnd
        : null,
    scrollTop: activeElement instanceof HTMLTextAreaElement ? activeElement.scrollTop : null,
  }
}

function resolveFocusByPath(path: number[]): Element | null {
  let current: Element = root

  for (const childIndex of path) {
    const next = current.children.item(childIndex)
    if (!(next instanceof Element)) return null
    current = next
  }

  return current
}

function restoreFocusSnapshot(snapshot: FocusSnapshot | null): void {
  if (!snapshot) return

  const candidate =
    (snapshot.selector ? root.querySelector(snapshot.selector) : null) ?? resolveFocusByPath(snapshot.path)

  if (!isFocusableField(candidate)) return

  candidate.focus()

  if (
    (candidate instanceof HTMLInputElement || candidate instanceof HTMLTextAreaElement) &&
    snapshot.selectionStart !== null &&
    snapshot.selectionEnd !== null
  ) {
    try {
      candidate.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
    } catch {
      // Ignore unsupported selection restoration.
    }
  }

  if (candidate instanceof HTMLTextAreaElement && snapshot.scrollTop !== null) {
    candidate.scrollTop = snapshot.scrollTop
  }
}

function renderWithFocusRestore(snapshot: FocusSnapshot | null): void {
  render()
  restoreFocusSnapshot(snapshot)
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
    if (inputType === 'file') return true
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

const SHELL_ACTIONS = new Set([
  'switch-system',
  'set-sidebar-open',
  'toggle-sidebar-collapsed',
  'toggle-menu-group',
  'toggle-menu-item',
  'open-tab',
  'activate-tab',
  'close-tab',
  'close-all-tabs',
])

function handleShellAction(actionNode: HTMLElement): boolean {
  const action = actionNode.dataset.action
  if (!action || !SHELL_ACTIONS.has(action)) return false

  if (action === 'switch-system') {
    const systemId = actionNode.dataset.systemId
    if (systemId) {
      appStore.switchSystem(systemId)
      closeMobileSidebar()
    }
    return true
  }

  if (action === 'set-sidebar-open') {
    appStore.setSidebarOpen(actionNode.dataset.sidebarOpen === 'true')
    return true
  }

  if (action === 'toggle-sidebar-collapsed') {
    appStore.toggleSidebarCollapsed()
    return true
  }

  if (action === 'toggle-menu-group') {
    const groupKey = actionNode.dataset.groupKey
    if (groupKey) appStore.toggleGroup(groupKey)
    return true
  }

  if (action === 'toggle-menu-item') {
    const itemKey = actionNode.dataset.itemKey
    if (itemKey) appStore.toggleItem(itemKey)
    return true
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
    return true
  }

  if (action === 'activate-tab') {
    const key = actionNode.dataset.tabKey
    if (key) appStore.activateTab(key)
    return true
  }

  if (action === 'close-tab') {
    const key = actionNode.dataset.tabKey
    if (key) appStore.closeTab(key)
    return true
  }

  if (action === 'close-all-tabs') {
    appStore.closeAllTabs()
    return true
  }

  return false
}

root.addEventListener('click', (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return

  if (shouldBypassClickDispatch(target)) return

  const shellActionNode = target.closest<HTMLElement>('[data-action]')
  if (shellActionNode && handleShellAction(shellActionNode)) {
    event.preventDefault()
    return
  }

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

  if (handleShellAction(actionNode)) {
    event.preventDefault()
  }
})

root.addEventListener('input', (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return
  const focusSnapshot = captureFocusSnapshot()

  if (dispatchPcsInputEvent(target)) {
    renderWithFocusRestore(focusSnapshot)
    return
  }

  if (dispatchPageEvent(target)) {
    renderWithFocusRestore(focusSnapshot)
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

window.addEventListener('popstate', () => {
  const pathname = `${window.location.pathname}${window.location.search}` || '/'
  appStore.syncFromBrowser(pathname)
})

appStore.subscribe(render)
window.addEventListener('higood:request-render', () => {
  render()
})
render()
