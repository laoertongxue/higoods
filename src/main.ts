import './styles.css'
import { hydrateRealQRCodes } from './components/real-qr'
import { hydrateIcons, renderAppShell, renderSidebar } from './components/shell'
import { appStore } from './state/store'

type FcsHandlersModule = typeof import('./main-handlers/fcs-handlers')
type PcsHandlersModule = typeof import('./main-handlers/pcs-handlers')
type PdaHandlersModule = typeof import('./main-handlers/pda-handlers')
type DispatchBoardPageModule = typeof import('./pages/dispatch-board')
type FactoryProfilePageModule = typeof import('./pages/factory-profile')
type CraftCuttingMarkerPlanPageModule = typeof import('./pages/process-factory/cutting/marker-plan')
type CraftCuttingMarkerSpreadingPageModule = typeof import('./pages/process-factory/cutting/marker-spreading')
type CraftCuttingTransferBagsPageModule = typeof import('./pages/process-factory/cutting/transfer-bags')
type CraftPrintingWarehousePageModule = typeof import('./pages/process-factory/printing/warehouse')
type CraftDyeingWarehousePageModule = typeof import('./pages/process-factory/dyeing/warehouse')
type FactoryWarehouseSharedModule = typeof import('./pages/process-factory/shared/warehouse-standard')
type PrintPreviewPageModule = typeof import('./pages/print/print-preview')
type PdaExecPageModule = typeof import('./pages/pda-exec')
type PdaWarehousePageModule = typeof import('./pages/pda-warehouse')
type RoutesModule = typeof import('./router/routes')

let fcsHandlersModulePromise: Promise<FcsHandlersModule> | null = null
let pcsHandlersModulePromise: Promise<PcsHandlersModule> | null = null
let pdaHandlersModulePromise: Promise<PdaHandlersModule> | null = null
let dispatchBoardPageModulePromise: Promise<DispatchBoardPageModule> | null = null
let factoryProfilePageModulePromise: Promise<FactoryProfilePageModule> | null = null
let craftCuttingMarkerPlanPageModulePromise: Promise<CraftCuttingMarkerPlanPageModule> | null = null
let craftCuttingMarkerSpreadingPageModulePromise: Promise<CraftCuttingMarkerSpreadingPageModule> | null = null
let craftCuttingTransferBagsPageModulePromise: Promise<CraftCuttingTransferBagsPageModule> | null = null
let craftPrintingWarehousePageModulePromise: Promise<CraftPrintingWarehousePageModule> | null = null
let craftDyeingWarehousePageModulePromise: Promise<CraftDyeingWarehousePageModule> | null = null
let factoryWarehouseSharedModulePromise: Promise<FactoryWarehouseSharedModule> | null = null
let printPreviewPageModulePromise: Promise<PrintPreviewPageModule> | null = null
let pdaExecPageModulePromise: Promise<PdaExecPageModule> | null = null
let pdaWarehousePageModulePromise: Promise<PdaWarehousePageModule> | null = null
let routesModulePromise: Promise<RoutesModule> | null = null
type StoreRenderMode = 'full' | 'sidebar'

let nextStoreRenderMode: StoreRenderMode = 'full'

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

function getDispatchBoardPageModule(): Promise<DispatchBoardPageModule> {
  if (!dispatchBoardPageModulePromise) {
    dispatchBoardPageModulePromise = import('./pages/dispatch-board').catch((error) => {
      dispatchBoardPageModulePromise = null
      throw error
    })
  }
  return dispatchBoardPageModulePromise
}

function getFactoryProfilePageModule(): Promise<FactoryProfilePageModule> {
  if (!factoryProfilePageModulePromise) {
    factoryProfilePageModulePromise = import('./pages/factory-profile').catch((error) => {
      factoryProfilePageModulePromise = null
      throw error
    })
  }
  return factoryProfilePageModulePromise
}

function getCraftCuttingMarkerPlanPageModule(): Promise<CraftCuttingMarkerPlanPageModule> {
  if (!craftCuttingMarkerPlanPageModulePromise) {
    craftCuttingMarkerPlanPageModulePromise = import('./pages/process-factory/cutting/marker-plan').catch((error) => {
      craftCuttingMarkerPlanPageModulePromise = null
      throw error
    })
  }
  return craftCuttingMarkerPlanPageModulePromise
}

function getCraftCuttingMarkerSpreadingPageModule(): Promise<CraftCuttingMarkerSpreadingPageModule> {
  if (!craftCuttingMarkerSpreadingPageModulePromise) {
    craftCuttingMarkerSpreadingPageModulePromise = import('./pages/process-factory/cutting/marker-spreading').catch((error) => {
      craftCuttingMarkerSpreadingPageModulePromise = null
      throw error
    })
  }
  return craftCuttingMarkerSpreadingPageModulePromise
}

function getCraftCuttingTransferBagsPageModule(): Promise<CraftCuttingTransferBagsPageModule> {
  if (!craftCuttingTransferBagsPageModulePromise) {
    craftCuttingTransferBagsPageModulePromise = import('./pages/process-factory/cutting/transfer-bags').catch((error) => {
      craftCuttingTransferBagsPageModulePromise = null
      throw error
    })
  }
  return craftCuttingTransferBagsPageModulePromise
}

function getCraftPrintingWarehousePageModule(): Promise<CraftPrintingWarehousePageModule> {
  if (!craftPrintingWarehousePageModulePromise) {
    craftPrintingWarehousePageModulePromise = import('./pages/process-factory/printing/warehouse').catch((error) => {
      craftPrintingWarehousePageModulePromise = null
      throw error
    })
  }
  return craftPrintingWarehousePageModulePromise
}

function getCraftDyeingWarehousePageModule(): Promise<CraftDyeingWarehousePageModule> {
  if (!craftDyeingWarehousePageModulePromise) {
    craftDyeingWarehousePageModulePromise = import('./pages/process-factory/dyeing/warehouse').catch((error) => {
      craftDyeingWarehousePageModulePromise = null
      throw error
    })
  }
  return craftDyeingWarehousePageModulePromise
}

function getFactoryWarehouseSharedModule(): Promise<FactoryWarehouseSharedModule> {
  if (!factoryWarehouseSharedModulePromise) {
    factoryWarehouseSharedModulePromise = import('./pages/process-factory/shared/warehouse-standard').catch((error) => {
      factoryWarehouseSharedModulePromise = null
      throw error
    })
  }
  return factoryWarehouseSharedModulePromise
}

function getPrintPreviewPageModule(): Promise<PrintPreviewPageModule> {
  if (!printPreviewPageModulePromise) {
    printPreviewPageModulePromise = import('./pages/print/print-preview').catch((error) => {
      printPreviewPageModulePromise = null
      throw error
    })
  }
  return printPreviewPageModulePromise
}

function getPdaExecPageModule(): Promise<PdaExecPageModule> {
  if (!pdaExecPageModulePromise) {
    pdaExecPageModulePromise = import('./pages/pda-exec').catch((error) => {
      pdaExecPageModulePromise = null
      throw error
    })
  }
  return pdaExecPageModulePromise
}

function getPdaWarehousePageModule(): Promise<PdaWarehousePageModule> {
  if (!pdaWarehousePageModulePromise) {
    pdaWarehousePageModulePromise = import('./pages/pda-warehouse').catch((error) => {
      pdaWarehousePageModulePromise = null
      throw error
    })
  }
  return pdaWarehousePageModulePromise
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
let dynamicModuleReloadScheduled = false

function clearPreloadReloadFlag(): void {
  try {
    sessionStorage.removeItem(PRELOAD_ERROR_RELOAD_KEY)
  } catch {
    // ignore session storage errors in prototype
  }
}

function isDynamicModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('ChunkLoadError')
  )
}

function shouldReloadForModuleLoadError(): boolean {
  try {
    const currentPath = `${window.location.pathname}${window.location.search}`
    const current = sessionStorage.getItem(PRELOAD_ERROR_RELOAD_KEY)
    if (current) {
      const parsed = JSON.parse(current) as { path?: string; at?: number }
      const samePath = parsed.path === currentPath
      const recentlyReloaded = typeof parsed.at === 'number' && Date.now() - parsed.at < 30_000
      if (samePath && recentlyReloaded) return false
    }
    sessionStorage.setItem(
      PRELOAD_ERROR_RELOAD_KEY,
      JSON.stringify({ path: currentPath, at: Date.now() }),
    )
    return true
  } catch {
    return true
  }
}

function reloadForDynamicModuleLoadError(error: unknown, source: string): boolean {
  if (!isDynamicModuleLoadError(error)) return false

  if (!shouldReloadForModuleLoadError()) {
    console.error(`${source}动态模块加载失败，自动刷新后仍未恢复。`, error)
    return true
  }

  console.warn(`${source}动态模块加载失败，将按当前地址刷新一次。`, error)
  dynamicModuleReloadScheduled = true
  window.location.reload()
  return true
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const preloadError =
    'payload' in event
      ? (event as Event & { payload?: unknown }).payload
      : event instanceof CustomEvent
        ? event.detail
        : event
  reloadForDynamicModuleLoadError(preloadError, 'Vite 预加载')
})

window.addEventListener('unhandledrejection', (event) => {
  if (reloadForDynamicModuleLoadError(event.reason, '未处理 Promise ')) {
    event.preventDefault()
  }
})

window.addEventListener('error', (event) => {
  if (reloadForDynamicModuleLoadError(event.error ?? event.message, '全局脚本')) {
    event.preventDefault()
  }
})

async function dispatchPageEvent(target: Element): Promise<boolean> {
  const eventTarget = target as HTMLElement
  const pathname = appStore.getState().pathname
  if (pathname.startsWith('/fcs/factories/profile')) {
    try {
      const factoryProfilePage = await getFactoryProfilePageModule()
      return factoryProfilePage.handleFactoryPageEvent(eventTarget)
    } catch (error) {
      if (reloadForDynamicModuleLoadError(error, '工厂档案事件处理器')) return false
      console.error('工厂档案事件处理器加载失败，已降级为不处理', error)
      return false
    }
  }

  if (pathname.startsWith('/fcs/dispatch/board')) {
    const dispatchBoardPage = await getDispatchBoardPageModule()
    return dispatchBoardPage.handleDispatchBoardEvent(eventTarget)
  }
  if (
    pathname.startsWith('/fcs/craft/cutting/marker-list') ||
    pathname.startsWith('/fcs/craft/cutting/marker-create') ||
    pathname.startsWith('/fcs/craft/cutting/marker-edit') ||
    pathname.startsWith('/fcs/craft/cutting/marker-detail')
  ) {
    const markerPlanPage = await getCraftCuttingMarkerPlanPageModule()
    return markerPlanPage.handleCraftCuttingMarkerPlanEvent(eventTarget)
  }
  if (
    pathname.startsWith('/fcs/craft/cutting/spreading') ||
    pathname.startsWith('/fcs/craft/cutting/marker-spreading') ||
    pathname.startsWith('/fcs/craft/cutting/spreading-create') ||
    pathname.startsWith('/fcs/craft/cutting/spreading-detail')
  ) {
    const markerSpreadingPage = await getCraftCuttingMarkerSpreadingPageModule()
    return markerSpreadingPage.handleCraftCuttingMarkerSpreadingEvent(eventTarget)
  }
  if (pathname.startsWith('/fcs/craft/cutting/transfer-bags')) {
    const transferBagsPage = await getCraftCuttingTransferBagsPageModule()
    return transferBagsPage.handleCraftCuttingTransferBagsEvent(eventTarget)
  }

  const handlerSystem = getCurrentHandlerSystem(pathname)
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

    if (await fcsHandlers.dispatchFcsPageEvent(eventTarget)) {
      return true
    }

    if (await pcsHandlers.dispatchPcsPageEvent(eventTarget)) {
      return true
    }

    return pdaHandlers.dispatchPdaPageEvent(eventTarget)
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, '页面事件处理器')) return false
    console.error('页面事件处理器加载失败，已降级为不处理', error)
    return false
  }
}

async function dispatchPageSubmit(form: HTMLFormElement): Promise<boolean> {
  const pathname = appStore.getState().pathname
  if (pathname.startsWith('/fcs/factories/profile')) {
    try {
      const factoryProfilePage = await getFactoryProfilePageModule()
      return factoryProfilePage.handleFactoryPageSubmit(form)
    } catch (error) {
      if (reloadForDynamicModuleLoadError(error, '工厂档案提交处理器')) return false
      console.error('工厂档案提交处理器加载失败，已降级为不提交', error)
      return false
    }
  }

  try {
    const fcsHandlers = await getFcsHandlersModule()
    return fcsHandlers.dispatchFcsPageSubmit(form)
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, '页面提交处理器')) return false
    console.error('页面提交处理器加载失败，已降级为不提交', error)
    return false
  }
}

async function dispatchPcsInputEvent(target: Element): Promise<boolean> {
  const pathname = appStore.getState().pathname || ''
  if (!pathname.startsWith('/pcs')) return false
  if (pathname.startsWith('/fcs/pda')) return false

  try {
    const pcsHandlers = await getPcsHandlersModule()
    return pcsHandlers.dispatchPcsInputEvent(target)
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, '输入处理器')) return false
    console.error('输入处理器加载失败，已降级为不处理', error)
    return false
  }
}

async function closeDialogsOnEscape(): Promise<boolean> {
  const pathname = appStore.getState().pathname
  if (pathname.startsWith('/fcs/factories/profile')) {
    try {
      const factoryProfilePage = await getFactoryProfilePageModule()
      if (!factoryProfilePage.isFactoryPageOpenDialog()) return false
      const fakeButton = document.createElement('button')
      fakeButton.dataset.factoryAction = 'close-dialog'
      return factoryProfilePage.handleFactoryPageEvent(fakeButton)
    } catch (error) {
      if (reloadForDynamicModuleLoadError(error, '工厂档案弹窗处理器')) return false
      console.error('工厂档案弹窗处理器加载失败', error)
      return false
    }
  }

  const handlerSystem = getCurrentHandlerSystem(pathname)
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
    if (fcsHandlers.closeFcsDialogsOnEscape()) {
      return true
    }

    if (await pcsHandlers.closePcsDialogsOnEscape()) {
      return true
    }

    return pdaHandlers.closePdaDialogsOnEscape()
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, '弹窗处理器')) return false
    console.error('弹窗处理器加载失败', error)
    return false
  }
}

let renderSerial = 0

function isPdaPath(pathname: string): boolean {
  return pathname.split('?')[0].split('#')[0].startsWith('/fcs/pda')
}

function renderPdaLoadingShell(): string {
  return `
    <section class="relative flex h-screen min-h-0 flex-col overflow-hidden bg-background">
      <header class="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div class="h-5 w-44 rounded bg-muted"></div>
        <div class="mt-1 h-3 w-16 rounded bg-muted"></div>
      </header>
      <main class="min-h-0 flex-1 overflow-hidden px-4 py-4">
        <div class="rounded-3xl border bg-card px-4 py-4 shadow-sm">
          <div class="h-5 w-24 rounded bg-muted"></div>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="h-20 rounded-2xl bg-muted/70"></div>
            <div class="h-20 rounded-2xl bg-muted/70"></div>
            <div class="h-20 rounded-2xl bg-muted/70"></div>
            <div class="h-20 rounded-2xl bg-muted/70"></div>
          </div>
        </div>
        <div class="mt-4 rounded-3xl border bg-card px-4 py-4 shadow-sm">
          <div class="h-5 w-20 rounded bg-muted"></div>
          <div class="mt-3 h-14 rounded-2xl bg-muted/70"></div>
          <div class="mt-3 grid grid-cols-4 gap-2">
            <div class="h-12 rounded-2xl bg-muted/70"></div>
            <div class="h-12 rounded-2xl bg-muted/70"></div>
            <div class="h-12 rounded-2xl bg-muted/70"></div>
            <div class="h-12 rounded-2xl bg-muted/70"></div>
          </div>
        </div>
      </main>
      <nav class="absolute bottom-0 left-0 right-0 z-10 flex h-[72px] items-center justify-around border-t bg-background px-1">
        ${['接单', '执行', '交接', '仓管', '结算']
          .map(
            (label) => `
              <div class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2">
                <div class="h-5 w-5 rounded bg-muted"></div>
                <div class="text-[10px] font-medium leading-tight text-muted-foreground">${label}</div>
              </div>
            `,
          )
          .join('')}
      </nav>
    </section>
  `
}

function ensureInitialPdaLoadingShell(state = appStore.getState()): void {
  if (!isPdaPath(state.pathname)) return
  if (root.childElementCount > 0) return
  root.innerHTML = renderAppShell(state, renderPdaLoadingShell())
}

async function renderCurrentPageContent(pathname: string): Promise<string> {
  try {
    const normalizedPathname = pathname.split('?')[0].split('#')[0]
    if (normalizedPathname === '/fcs/pda/exec') {
      const pdaExecPage = await getPdaExecPageModule()
      return pdaExecPage.renderPdaExecPage()
    }
    if (normalizedPathname === '/fcs/pda/warehouse') {
      const pdaWarehousePage = await getPdaWarehousePageModule()
      return pdaWarehousePage.renderPdaWarehousePage()
    }
    if (normalizedPathname === '/fcs/craft/printing/wait-process-warehouse') {
      const printingWarehousePage = await getCraftPrintingWarehousePageModule()
      return printingWarehousePage.renderCraftPrintingWaitProcessWarehousePage()
    }
    if (normalizedPathname === '/fcs/craft/printing/wait-handover-warehouse') {
      const printingWarehousePage = await getCraftPrintingWarehousePageModule()
      return printingWarehousePage.renderCraftPrintingWaitHandoverWarehousePage()
    }
    if (normalizedPathname === '/fcs/craft/dyeing/wait-process-warehouse') {
      const dyeingWarehousePage = await getCraftDyeingWarehousePageModule()
      return dyeingWarehousePage.renderCraftDyeingWaitProcessWarehousePage()
    }
    if (normalizedPathname === '/fcs/craft/dyeing/wait-handover-warehouse') {
      const dyeingWarehousePage = await getCraftDyeingWarehousePageModule()
      return dyeingWarehousePage.renderCraftDyeingWaitHandoverWarehousePage()
    }
    if (normalizedPathname === '/fcs/craft/cutting/transfer-bags') {
      const transferBagsPage = await getCraftCuttingTransferBagsPageModule()
      return transferBagsPage.renderCraftCuttingTransferBagsPage()
    }
    if (normalizedPathname === '/fcs/craft/cutting/transfer-bag-detail') {
      const transferBagsPage = await getCraftCuttingTransferBagsPageModule()
      return transferBagsPage.renderCraftCuttingTransferBagDetailPage()
    }
    if (normalizedPathname === '/fcs/craft/cutting/spreading-list') {
      const markerSpreadingPage = await getCraftCuttingMarkerSpreadingPageModule()
      return markerSpreadingPage.renderCraftCuttingSpreadingListPage()
    }
    if (normalizedPathname === '/fcs/craft/cutting/spreading-create') {
      const markerSpreadingPage = await getCraftCuttingMarkerSpreadingPageModule()
      return markerSpreadingPage.renderCraftCuttingSpreadingCreatePage()
    }
    if (normalizedPathname === '/fcs/craft/cutting/spreading-detail') {
      const markerSpreadingPage = await getCraftCuttingMarkerSpreadingPageModule()
      return markerSpreadingPage.renderCraftCuttingSpreadingDetailPage()
    }
    if (normalizedPathname === '/fcs/craft/cutting/spreading-edit') {
      const markerSpreadingPage = await getCraftCuttingMarkerSpreadingPageModule()
      return markerSpreadingPage.renderCraftCuttingSpreadingEditPage()
    }
    if (normalizedPathname === '/fcs/craft/cutting/marker-spreading') {
      const markerSpreadingPage = await getCraftCuttingMarkerSpreadingPageModule()
      return markerSpreadingPage.renderCraftCuttingMarkerSpreadingPage()
    }
    if (normalizedPathname === '/fcs/print/preview') {
      const printPreviewPage = await getPrintPreviewPageModule()
      return printPreviewPage.renderPrintPreviewPage()
    }
    const { resolvePage } = await getRoutesModule()
    return resolvePage(pathname)
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, '路由模块')) {
      return '<section class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">页面模块加载失败，正在刷新当前页面。</section>'
    }
    console.error('路由模块加载失败，进入降级页', error)
    return '<section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">页面内容加载失败，请稍后重试。</section>'
  }
}

async function render(): Promise<void> {
  const currentSerial = ++renderSerial
  const state = appStore.getState()

  ensureInitialPdaLoadingShell(state)
  const pageContent = await renderCurrentPageContent(state.pathname)
  if (currentSerial !== renderSerial) {
    return
  }

  root.innerHTML = renderAppShell(state, pageContent)
  hydrateIcons(root)
  hydrateRealQRCodes(root)
  if (!dynamicModuleReloadScheduled) {
    clearPreloadReloadFlag()
  }
}

async function renderSidebarOnly(): Promise<void> {
  const sidebarHost = root.querySelector('[data-shell-sidebar-root="true"]')
  if (!(sidebarHost instanceof HTMLElement)) {
    await render()
    return
  }

  sidebarHost.innerHTML = renderSidebar(appStore.getState())
  hydrateIcons(sidebarHost)
}

function markNextStoreRenderAsSidebarOnly(): void {
  nextStoreRenderMode = 'sidebar'
}

function getPageContentHost(): HTMLDivElement | null {
  const host = root.querySelector('[data-page-content-root="true"]')
  return host instanceof HTMLDivElement ? host : null
}

function normalizePathname(pathname: string): string {
  return pathname.split('?')[0].split('#')[0] || '/'
}

function isTechPackPageMounted(): boolean {
  return Boolean(root.querySelector('[data-tech-pack-page-root="true"]'))
}

function shouldUseTechPackScopedRender(target: Element | null, previousPathname: string, nextPathname: string): boolean {
  if (!(target instanceof Element)) return false
  if (normalizePathname(previousPathname) !== normalizePathname(nextPathname)) return false
  const isTechPackTarget = Boolean(target.closest('[data-tech-pack-page-root="true"]'))
  const isCuttingMarkerTarget = Boolean(target.closest([
    '[data-testid="cutting-marker-plan-list-page"]',
    '[data-testid="cutting-marker-plan-create-page"]',
    '[data-testid="cutting-marker-plan-edit-page"]',
    '[data-testid="cutting-marker-plan-detail-page"]',
  ].join(',')))
  if (!isTechPackTarget && !isCuttingMarkerTarget) return false

  const actionNode = target.closest<HTMLElement>('[data-tech-action]')
  const action = actionNode?.dataset.techAction
  if (action === 'tech-back') return false

  return true
}

async function renderPageContentOnly(): Promise<void> {
  const currentSerial = ++renderSerial
  const state = appStore.getState()
  const pageContent = await renderCurrentPageContent(state.pathname)
  if (currentSerial !== renderSerial) {
    return
  }

  const pageContentHost = getPageContentHost()
  if (!pageContentHost) {
    await render()
    return
  }

  pageContentHost.innerHTML = pageContent
  hydrateRealQRCodes(pageContentHost)
  queueMicrotask(() => {
    hydrateIcons(pageContentHost)
  })
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

async function renderPageContentOnlyWithFocusRestore(snapshot: FocusSnapshot | null): Promise<void> {
  await renderPageContentOnly()
  restoreFocusSnapshot(snapshot)
}

function closeMobileSidebar(): void {
  const { sidebarOpen } = appStore.getState()
  if (sidebarOpen) {
    markNextStoreRenderAsSidebarOnly()
    appStore.setSidebarOpen(false)
  }
}

function navigateWithImmediateSidebar(pathname: string): void {
  markNextStoreRenderAsSidebarOnly()
  appStore.navigate(pathname)
  closeMobileSidebar()
  void renderPageContentOnly()
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

function shouldSkipInputRerender(target: Element): boolean {
  const techFieldNode = target.closest<HTMLElement>('[data-tech-field]')
  if (techFieldNode) {
    const field = techFieldNode.dataset.techField || ''
    if (field === 'pattern-template-search-keyword') return false
    if (field === 'new-pattern-piece-color-count') return false

    if (techFieldNode instanceof HTMLTextAreaElement) return true

    if (techFieldNode instanceof HTMLInputElement) {
      const inputType = (techFieldNode.type || 'text').toLowerCase()
      const rerenderDrivenTypes = new Set(['checkbox', 'radio', 'file', 'range', 'color'])
      return !rerenderDrivenTypes.has(inputType)
    }

    return false
  }

  const pdaLoginFieldNode = target.closest<HTMLElement>('[data-pda-login-field]')
  if (pdaLoginFieldNode instanceof HTMLInputElement || pdaLoginFieldNode instanceof HTMLTextAreaElement) {
    return true
  }

  const pdaCutHandoverFieldNode = target.closest<HTMLElement>('[data-pda-cut-handover-field]')
  if (pdaCutHandoverFieldNode instanceof HTMLInputElement || pdaCutHandoverFieldNode instanceof HTMLTextAreaElement) {
    return true
  }

  const markerPlanInputNode = target.closest<HTMLElement>(
    [
      '[data-marker-plan-filter-field]',
      '[data-marker-plan-context-field]',
      '[data-marker-plan-basic-field]',
      '[data-marker-plan-textarea-field]',
      '[data-marker-plan-size-piece-per-layer]',
      '[data-marker-plan-matrix-cell]',
      '[data-marker-plan-matrix-row-length]',
      '[data-marker-plan-bed-field]',
      '[data-marker-plan-fold-field]',
      '[data-marker-plan-mapping-field]',
    ].join(', '),
  )
  if (markerPlanInputNode instanceof HTMLInputElement || markerPlanInputNode instanceof HTMLTextAreaElement) {
    const inputType = markerPlanInputNode instanceof HTMLInputElement ? (markerPlanInputNode.type || 'text').toLowerCase() : 'text'
    if (inputType === 'checkbox' || inputType === 'radio') return false
    return true
  }

  const pdaOnboardingFieldNode = target.closest<HTMLElement>('[data-pda-onboarding-field], [data-pda-onboarding-machine-field]')
  if (pdaOnboardingFieldNode instanceof HTMLInputElement || pdaOnboardingFieldNode instanceof HTMLTextAreaElement) {
    return true
  }

  const factoryOnboardingFieldNode = target.closest<HTMLElement>('[data-factory-onboarding-field]')
  if (factoryOnboardingFieldNode instanceof HTMLInputElement || factoryOnboardingFieldNode instanceof HTMLTextAreaElement) {
    if (factoryOnboardingFieldNode instanceof HTMLInputElement) {
      const inputType = (factoryOnboardingFieldNode.type || 'text').toLowerCase()
      if (inputType === 'radio' || inputType === 'checkbox') return false
    }
    return true
  }

  const factoryProfileFieldNode = target.closest<HTMLElement>('[data-factory-field], [data-pda-field]')
  if (factoryProfileFieldNode instanceof HTMLInputElement || factoryProfileFieldNode instanceof HTMLTextAreaElement) {
    const inputType = factoryProfileFieldNode instanceof HTMLInputElement
      ? (factoryProfileFieldNode.type || 'text').toLowerCase()
      : 'text'
    return !['checkbox', 'radio', 'file', 'range', 'color'].includes(inputType)
  }

  return false
}

function shouldSkipChangeRerender(target: Element): boolean {
  const techFieldNode = target.closest<HTMLElement>('[data-tech-field]')
  if (techFieldNode) {
    const field = techFieldNode.dataset.techField || ''
    const rerenderDrivenFields = new Set([
      'new-pattern-material-type',
      'new-pattern-linked-bom-item',
      'new-pattern-prj-file',
      'new-pattern-marker-image-file',
      'new-pattern-dxf-file',
      'new-pattern-rul-file',
      'new-pattern-single-file',
      'new-pattern-piece-is-template',
      'pattern-template-search-keyword',
      'new-bom-print-requirement',
      'new-bom-print-side-mode',
      'new-design-file',
    ])

    return !rerenderDrivenFields.has(field)
  }

  const pdaLoginFieldNode = target.closest<HTMLElement>('[data-pda-login-field]')
  if (pdaLoginFieldNode instanceof HTMLInputElement || pdaLoginFieldNode instanceof HTMLTextAreaElement) {
    return true
  }

  const pdaCutHandoverFieldNode = target.closest<HTMLElement>('[data-pda-cut-handover-field]')
  if (pdaCutHandoverFieldNode instanceof HTMLInputElement || pdaCutHandoverFieldNode instanceof HTMLTextAreaElement) {
    return true
  }

  const pdaOnboardingFieldNode = target.closest<HTMLElement>('[data-pda-onboarding-field], [data-pda-onboarding-machine-field]')
  if (pdaOnboardingFieldNode instanceof HTMLInputElement || pdaOnboardingFieldNode instanceof HTMLTextAreaElement) {
    return true
  }

  const factoryOnboardingFieldNode = target.closest<HTMLElement>('[data-factory-onboarding-field]')
  if (factoryOnboardingFieldNode instanceof HTMLInputElement || factoryOnboardingFieldNode instanceof HTMLTextAreaElement) {
    if (factoryOnboardingFieldNode instanceof HTMLInputElement) {
      const inputType = (factoryOnboardingFieldNode.type || 'text').toLowerCase()
      if (inputType === 'radio' || inputType === 'checkbox') return false
    }
    return true
  }

  const factoryProfileFieldNode = target.closest<HTMLElement>('[data-factory-field], [data-pda-field]')
  if (factoryProfileFieldNode instanceof HTMLInputElement || factoryProfileFieldNode instanceof HTMLTextAreaElement) {
    const inputType = factoryProfileFieldNode instanceof HTMLInputElement
      ? (factoryProfileFieldNode.type || 'text').toLowerCase()
      : 'text'
    return !['checkbox', 'radio', 'file', 'range', 'color'].includes(inputType)
  }

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
    markNextStoreRenderAsSidebarOnly()
    appStore.setSidebarOpen(actionNode.dataset.sidebarOpen === 'true')
    return true
  }

  if (action === 'toggle-sidebar-collapsed') {
    markNextStoreRenderAsSidebarOnly()
    appStore.toggleSidebarCollapsed()
    return true
  }

  if (action === 'toggle-menu-group') {
    const groupKey = actionNode.dataset.groupKey
    if (groupKey) {
      markNextStoreRenderAsSidebarOnly()
      appStore.toggleGroup(groupKey)
    }
    return true
  }

  if (action === 'toggle-menu-item') {
    const itemKey = actionNode.dataset.itemKey
    if (itemKey) {
      markNextStoreRenderAsSidebarOnly()
      appStore.toggleItem(itemKey)
    }
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
  const focusSnapshot = captureFocusSnapshot()
  const previousPathname = appStore.getState().pathname

  if (shouldBypassClickDispatch(target)) return

  const shellActionNode = target.closest<HTMLElement>('[data-action]')
  if (shellActionNode && handleShellAction(shellActionNode)) {
    event.preventDefault()
    return
  }

  const warehouseSharedNode = target.closest<HTMLElement>('[data-warehouse-flow-action], [data-factory-warehouse-location-action]')
  if (warehouseSharedNode) {
    event.preventDefault()
    const warehouseShared = await getFactoryWarehouseSharedModule()
    if (await warehouseShared.handleFactoryWarehouseSharedEvent(warehouseSharedNode)) {
      return
    }
  }

  const pdaCutInboundActionNode = target.closest<HTMLElement>('[data-pda-cut-inbound-action]')
  if (pdaCutInboundActionNode) {
    event.preventDefault()
    const pdaCuttingInboundPage = await import('./pages/pda-cutting-inbound')
    if (pdaCuttingInboundPage.handlePdaCuttingInboundEvent(pdaCutInboundActionNode)) {
      await renderWithFocusRestore(focusSnapshot)
      return
    }
  }

  const pdaCutHandoverActionNode = target.closest<HTMLElement>('[data-pda-cut-handover-action]')
  if (pdaCutHandoverActionNode) {
    event.preventDefault()
    const pdaCuttingHandoverPage = await import('./pages/pda-cutting-handover')
    if (pdaCuttingHandoverPage.handlePdaCuttingHandoverEvent(pdaCutHandoverActionNode)) {
      await renderWithFocusRestore(focusSnapshot)
      return
    }
  }

  const directNavNode = target.closest<HTMLElement>('[data-nav]')
  if (directNavNode?.dataset.nav && !hasDatasetAction(directNavNode)) {
    event.preventDefault()
    navigateWithImmediateSidebar(directNavNode.dataset.nav)
    return
  }

  if (await dispatchPageEvent(target)) {
    event.preventDefault()
    if (target.closest<HTMLElement>('[data-skip-page-rerender="true"]')) {
      return
    }
    const nextPathname = appStore.getState().pathname
    if (target.closest<HTMLElement>('[data-fast-page-render]') || shouldUseTechPackScopedRender(target, previousPathname, nextPathname)) {
      await renderPageContentOnlyWithFocusRestore(focusSnapshot)
    } else {
      await renderWithFocusRestore(focusSnapshot)
    }
    return
  }

  const navNode = target.closest<HTMLElement>('[data-nav]')
  if (navNode?.dataset.nav) {
    event.preventDefault()
    navigateWithImmediateSidebar(navNode.dataset.nav)
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
  const previousPathname = appStore.getState().pathname

  if (await dispatchPcsInputEvent(target)) {
    await renderWithFocusRestore(focusSnapshot)
    return
  }

  if (await dispatchPageEvent(target)) {
    if (shouldSkipInputRerender(target)) return
    const nextPathname = appStore.getState().pathname
    if (target.closest<HTMLElement>('[data-fast-page-render]') || shouldUseTechPackScopedRender(target, previousPathname, nextPathname)) {
      await renderPageContentOnlyWithFocusRestore(focusSnapshot)
    } else {
      await renderWithFocusRestore(focusSnapshot)
    }
  }
})

root.addEventListener('compositionend', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return
  const focusSnapshot = captureFocusSnapshot()
  const previousPathname = appStore.getState().pathname

  if (await dispatchPcsInputEvent(target)) {
    await renderWithFocusRestore(focusSnapshot)
    return
  }

  if (await dispatchPageEvent(target)) {
    if (shouldSkipInputRerender(target)) return
    const nextPathname = appStore.getState().pathname
    if (target.closest<HTMLElement>('[data-fast-page-render]') || shouldUseTechPackScopedRender(target, previousPathname, nextPathname)) {
      await renderPageContentOnlyWithFocusRestore(focusSnapshot)
    } else {
      await renderWithFocusRestore(focusSnapshot)
    }
  }
})

root.addEventListener('change', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return
  const focusSnapshot = captureFocusSnapshot()
  const previousPathname = appStore.getState().pathname

  if (await dispatchPageEvent(target)) {
    if (shouldSkipChangeRerender(target)) return
    const nextPathname = appStore.getState().pathname
    if (target.closest<HTMLElement>('[data-fast-page-render]') || shouldUseTechPackScopedRender(target, previousPathname, nextPathname)) {
      await renderPageContentOnlyWithFocusRestore(focusSnapshot)
    } else {
      await renderWithFocusRestore(focusSnapshot)
    }
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

  const shouldUseScopedRender = isTechPackPageMounted()
  if (await closeDialogsOnEscape()) {
    if (shouldUseScopedRender) {
      await renderPageContentOnly()
    } else {
      await render()
    }
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
  const renderMode = nextStoreRenderMode
  nextStoreRenderMode = 'full'

  if (renderMode === 'sidebar') {
    void renderSidebarOnly()
    return
  }

  void render()
})
window.addEventListener('higood:request-render', () => {
  const focusSnapshot = captureFocusSnapshot()
  if (isTechPackPageMounted()) {
    void renderPageContentOnlyWithFocusRestore(focusSnapshot)
    return
  }
  void renderWithFocusRestore(focusSnapshot)
})
void render()
