import './styles.css'
import { hydrateRealQRCodes } from './components/real-qr'
import { hydrateIcons, renderAppShell } from './components/shell'
import { appStore } from './state/store'

type FcsHandlersModule = typeof import('./main-handlers/fcs-handlers')
type PcsHandlersModule = typeof import('./main-handlers/pcs-handlers')
type PdaHandlersModule = typeof import('./main-handlers/pda-handlers')
type RoutesModule = typeof import('./router/routes')

const PLACEHOLDER_PAGE_CONTENT =
  '<section class="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">页面内容加载中…</section>'

let fcsHandlersModulePromise: Promise<FcsHandlersModule> | null = null
let pcsHandlersModulePromise: Promise<PcsHandlersModule> | null = null
let pdaHandlersModulePromise: Promise<PdaHandlersModule> | null = null
let routesModulePromise: Promise<RoutesModule> | null = null

function getFcsHandlersModule(): Promise<FcsHandlersModule> {
  if (!fcsHandlersModulePromise) {
    fcsHandlersModulePromise = import('./main-handlers/fcs-handlers').catch((error) => {
      fcsHandlersModulePromise = null
      throw error
    })
  }
  return fcsHandlersModulePromise
}

function getPcsHandlersModule(): Promise<PcsHandlersModule> {
  if (!pcsHandlersModulePromise) {
    pcsHandlersModulePromise = import('./main-handlers/pcs-handlers').catch((error) => {
      pcsHandlersModulePromise = null
      throw error
    })
  }
  return pcsHandlersModulePromise
}

function getPdaHandlersModule(): Promise<PdaHandlersModule> {
  if (!pdaHandlersModulePromise) {
    pdaHandlersModulePromise = import('./main-handlers/pda-handlers').catch((error) => {
      pdaHandlersModulePromise = null
      throw error
    })
  }
  return pdaHandlersModulePromise
}

function getRoutesModule(): Promise<RoutesModule> {
  if (!routesModulePromise) {
    routesModulePromise = import('./router/routes').catch((error) => {
      routesModulePromise = null
      throw error
    })
  }
  return routesModulePromise
}

function getCurrentHandlerSystem(pathname: string): 'pcs' | 'fcs' | 'pda' | 'all' {
  if (pathname.startsWith('/pcs')) return 'pcs'
  if (pathname.startsWith('/fcs/pda')) return 'pda'
  if (pathname.startsWith('/fcs')) return 'fcs'
  return 'all'
}

const rootNode = document.querySelector('#app')

if (!(rootNode instanceof HTMLDivElement)) {
  throw new Error('Missing #app root node')
}

const root = rootNode

appStore.init()

const PRELOAD_ERROR_RELOAD_KEY = 'higood-vite-preload-reload'

function clearPreloadReloadFlag(): void {
  try {
    sessionStorage.removeItem(PRELOAD_ERROR_RELOAD_KEY)
  } catch {
    // ignore session storage errors in prototype
  }
}

function shouldReloadForPreloadError(): boolean {
  try {
    const current = sessionStorage.getItem(PRELOAD_ERROR_RELOAD_KEY)
    if (current === '1') return false
    sessionStorage.setItem(PRELOAD_ERROR_RELOAD_KEY, '1')
    return true
  } catch {
    return true
  }
}

window.addEventListener('vite:preloadError', (event) => {
  if (!shouldReloadForPreloadError()) {
    console.error('动态模块加载失败，自动刷新后仍未恢复。', event)
    return
  }

  event.preventDefault()
  window.location.reload()
})

clearPreloadReloadFlag()

async function dispatchPageEvent(target: Element): Promise<boolean> {
  const eventTarget = target as HTMLElement
  const handlerSystem = getCurrentHandlerSystem(appStore.getState().pathname)
  try {
    if (handlerSystem === 'pcs') {
      const pcsHandlers = await getPcsHandlersModule()
      return pcsHandlers.dispatchPcsPageEvent(eventTarget)
    }
    if (handlerSystem === 'fcs') {
      const fcsHandlers = await getFcsHandlersModule()
      return fcsHandlers.dispatchFcsPageEvent(eventTarget)
    }
    if (handlerSystem === 'pda') {
      const pdaHandlers = await getPdaHandlersModule()
      return pdaHandlers.dispatchPdaPageEvent(eventTarget)
    }

    const [fcsHandlers, pcsHandlers, pdaHandlers] = await Promise.all([
      getFcsHandlersModule(),
      getPcsHandlersModule(),
      getPdaHandlersModule(),
    ])

    return (
      fcsHandlers.dispatchFcsPageEvent(eventTarget) ||
      pcsHandlers.dispatchPcsPageEvent(eventTarget) ||
      pdaHandlers.dispatchPdaPageEvent(eventTarget)
    )
  } catch (error) {
    console.error('页面事件处理器加载失败，已降级为不处理', error)
    return false
  }
}

async function dispatchPageSubmit(form: HTMLFormElement): Promise<boolean> {
  try {
    const fcsHandlers = await getFcsHandlersModule()
    return fcsHandlers.dispatchFcsPageSubmit(form)
  } catch (error) {
    console.error('页面提交处理器加载失败，已降级为不提交', error)
    return false
  }
}

async function dispatchPcsInputEvent(target: Element): Promise<boolean> {
  try {
    const pcsHandlers = await getPcsHandlersModule()
    return pcsHandlers.dispatchPcsInputEvent(target)
  } catch (error) {
    console.error('输入处理器加载失败，已降级为不处理', error)
    return false
  }
}

async function closeDialogsOnEscape(): Promise<boolean> {
  const handlerSystem = getCurrentHandlerSystem(appStore.getState().pathname)
  try {
    if (handlerSystem === 'pcs') {
      const pcsHandlers = await getPcsHandlersModule()
      return pcsHandlers.closePcsDialogsOnEscape()
    }
    if (handlerSystem === 'fcs') {
      const fcsHandlers = await getFcsHandlersModule()
      return fcsHandlers.closeFcsDialogsOnEscape()
    }
    if (handlerSystem === 'pda') {
      const pdaHandlers = await getPdaHandlersModule()
      return pdaHandlers.closePdaDialogsOnEscape()
    }

    const [fcsHandlers, pcsHandlers, pdaHandlers] = await Promise.all([
      getFcsHandlersModule(),
      getPcsHandlersModule(),
      getPdaHandlersModule(),
    ])
    return (
      fcsHandlers.closeFcsDialogsOnEscape() ||
      pcsHandlers.closePcsDialogsOnEscape() ||
      pdaHandlers.closePdaDialogsOnEscape()
    )
  } catch (error) {
    console.error('弹窗处理器加载失败', error)
    return false
  }
}

let renderSerial = 0

function renderLoadingContent(): string {
  return PLACEHOLDER_PAGE_CONTENT
}

async function renderCurrentPageContent(pathname: string): Promise<string> {
  try {
    const { resolvePage } = await getRoutesModule()
    return resolvePage(pathname)
  } catch (error) {
    console.error('路由模块加载失败，进入降级页', error)
    return '<section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">页面内容加载失败，请稍后重试。</section>'
  }
}

async function render(): Promise<void> {
  const currentSerial = ++renderSerial
  const state = appStore.getState()

  root.innerHTML = renderAppShell(state, renderLoadingContent())
  hydrateIcons(root)
  hydrateRealQRCodes(root)

  const pageContent = await renderCurrentPageContent(state.pathname)
  if (currentSerial !== renderSerial) {
    return
  }

  root.innerHTML = renderAppShell(state, pageContent)
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

async function renderWithFocusRestore(snapshot: FocusSnapshot | null): Promise<void> {
  await render()
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

function isComposingInputEvent(event: Event): boolean {
  return event instanceof InputEvent && event.isComposing
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

root.addEventListener('click', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return

  if (shouldBypassClickDispatch(target)) return

  const shellActionNode = target.closest<HTMLElement>('[data-action]')
  if (shellActionNode && handleShellAction(shellActionNode)) {
    event.preventDefault()
    return
  }

  const directNavNode = target.closest<HTMLElement>('[data-nav]')
  if (directNavNode?.dataset.nav && !hasDatasetAction(directNavNode)) {
    event.preventDefault()
    appStore.navigate(directNavNode.dataset.nav)
    closeMobileSidebar()
    return
  }

  if (await dispatchPageEvent(target)) {
    event.preventDefault()
    await render()
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

root.addEventListener('input', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return
  if (isComposingInputEvent(event)) return
  const focusSnapshot = captureFocusSnapshot()

  if (await dispatchPcsInputEvent(target)) {
    await renderWithFocusRestore(focusSnapshot)
    return
  }

  if (await dispatchPageEvent(target)) {
    await renderWithFocusRestore(focusSnapshot)
  }
})

root.addEventListener('compositionend', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return
  const focusSnapshot = captureFocusSnapshot()

  if (await dispatchPcsInputEvent(target)) {
    await renderWithFocusRestore(focusSnapshot)
    return
  }

  if (await dispatchPageEvent(target)) {
    await renderWithFocusRestore(focusSnapshot)
  }
})

root.addEventListener('change', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return

  if (await dispatchPageEvent(target)) {
    await render()
  }
})

root.addEventListener('submit', async (event) => {
  const target = event.target
  if (!(target instanceof HTMLFormElement)) return

  if (await dispatchPageSubmit(target)) {
    event.preventDefault()
    await render()
  }
})

document.addEventListener('keydown', async (event) => {
  if (event.key !== 'Escape') return

  if (await closeDialogsOnEscape()) {
    await render()
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

appStore.subscribe(() => {
  void render()
})
window.addEventListener('higood:request-render', () => {
  void render()
})
void render()
