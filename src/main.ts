import './styles.css'
import { handleProductionObjectFloatingEntryEvent } from './components/production-object-floating-entry'
import { hydrateRealQRCodes } from './components/real-qr'
import { hydrateIcons, isStandalonePrintPath, renderAppShell, renderSidebar } from './components/shell'
import { closePdaImagePreview, handlePdaImagePreviewEvent } from './components/ui/pda-image-preview'
import {
  getBrowserSessionStorage,
  readBrowserStorageItem,
  removeBrowserStorageItem,
  writeBrowserStorageItem,
} from './data/browser-storage'
import { resolvePdaCuttingScanKeydownTarget } from './main-handlers/pda-cutting-keydown-routing'
import { isPdaPageHandledLocally } from './main-handlers/pda-local-action-result'
import { createRetryableModuleLoader } from './main-infrastructure/retryable-module-loader'
import { appStore } from './state/store'

type StoreRenderMode = 'full' | 'sidebar'

let nextStoreRenderMode: StoreRenderMode = 'full'
let pdaMainTabPreloadStarted = false
let productionListPreloadStarted = false
let fcsHandlersPreloadStarted = false

const getProductionObjectOverviewModule = createRetryableModuleLoader(
  () => import('./components/production-object-overview'),
)
const getPdaCuttingInboundModule = createRetryableModuleLoader(() => import('./pages/pda-cutting-inbound'))
const getPdaCuttingHandoverModule = createRetryableModuleLoader(() => import('./pages/pda-cutting-handover'))
const getFcsHandlersModule = createRetryableModuleLoader(() => import('./main-handlers/fcs-handlers'))
const getPcsHandlersModule = createRetryableModuleLoader(() => import('./main-handlers/pcs-handlers'))
const getPdaHandlersModule = createRetryableModuleLoader(() => import('./main-handlers/pda-handlers'))
const getProcessWaterSolubleOrdersPageModule = createRetryableModuleLoader(
  () => import('./pages/process-water-soluble-orders'),
)
const getCraftDyeingWaterSolubleOrdersPageModule = createRetryableModuleLoader(
  () => import('./pages/process-factory/dyeing/water-soluble-orders'),
)
const getDispatchAcceptanceSlaPageModule = createRetryableModuleLoader(() => import('./pages/dispatch-acceptance-sla'))
const getTaskBreakdownPageModule = createRetryableModuleLoader(() => import('./pages/task-breakdown'))
const getWlsFabricDemandBoardPageModule = createRetryableModuleLoader(() => import('./pages/wls-fabric-demand-board'))
const getFactoryProfilePageModule = createRetryableModuleLoader(() => import('./pages/factory-profile'))
const getCraftCuttingMarkerPlanPageModule = createRetryableModuleLoader(
  () => import('./pages/process-factory/cutting/marker-plan'),
)
const getCraftCuttingMarkerSpreadingPageModule = createRetryableModuleLoader(
  () => import('./pages/process-factory/cutting/marker-spreading'),
)
const getCraftCuttingTransferBagsPageModule = createRetryableModuleLoader(
  () => import('./pages/process-factory/cutting/transfer-bags'),
)
const getCraftPrintingWarehousePageModule = createRetryableModuleLoader(
  () => import('./pages/process-factory/printing/warehouse'),
)
const getCraftDyeingWarehousePageModule = createRetryableModuleLoader(
  () => import('./pages/process-factory/dyeing/warehouse'),
)
const getFactoryWarehouseSharedModule = createRetryableModuleLoader(
  () => import('./pages/process-factory/shared/warehouse-standard'),
)
const getPrintPreviewPageModule = createRetryableModuleLoader(() => import('./pages/print/print-preview'))
const getPdaTaskReceivePageModule = createRetryableModuleLoader(() => import('./pages/pda-task-receive'))
const getPdaExecPageModule = createRetryableModuleLoader(() => import('./pages/pda-exec'))
const getPdaHandoverPageModule = createRetryableModuleLoader(() => import('./pages/pda-handover'))
const getPdaWarehousePageModule = createRetryableModuleLoader(() => import('./pages/pda-warehouse'))
const getPdaSettlementPageModule = createRetryableModuleLoader(() => import('./pages/pda-settlement'))
const getProductionOrderProgressTrackingPageModule = createRetryableModuleLoader(
  () => import('./pages/production-order-progress-tracking'),
)
const getProgressBoardPageModule = createRetryableModuleLoader(() => import('./pages/progress-board'))
const getProductionDemandPageModule = createRetryableModuleLoader(() => import('./pages/production/demand-domain'))
const getProductionOrdersPageModule = createRetryableModuleLoader(() => import('./pages/production/orders-domain'))
const getProductionEventsModule = createRetryableModuleLoader(() => import('./pages/production/events'))
const getProductionDialogsModule = createRetryableModuleLoader(() => import('./pages/production/dialogs'))
const getRoutesModule = createRetryableModuleLoader(() => import('./router/routes'))

async function handleActivePdaCuttingEvent(target: HTMLElement, event?: Event): Promise<unknown> {
  const pathname = appStore.getState().pathname
  if (pathname.startsWith('/fcs/pda/cutting/transfer-bag/')) {
    const pdaHandlers = await getPdaHandlersModule()
    return pdaHandlers.dispatchPdaPageEvent(target, event)
  }
  if (pathname.startsWith('/fcs/pda/cutting/inbound/')) {
    const module = await getPdaCuttingInboundModule()
    return module.handlePdaCuttingInboundEvent(target, event)
  }
  if (pathname.startsWith('/fcs/pda/cutting/handover/')) {
    const module = await getPdaCuttingHandoverModule()
    return module.handlePdaCuttingHandoverEvent(target, event)
  }
  return false
}

function preloadFcsHandlers(): void {
  if (fcsHandlersPreloadStarted) return
  fcsHandlersPreloadStarted = true
  void getFcsHandlersModule().catch((error) => {
    fcsHandlersPreloadStarted = false
    console.warn('FCS 页面事件处理器预加载失败，将在首次操作时重试', error)
  })
}

function scheduleProductionListPreload(): void {
  if (productionListPreloadStarted) return
  productionListPreloadStarted = true

  const preload = (): void => {
    void Promise.allSettled([
      getProductionDemandPageModule(),
      getProductionOrdersPageModule(),
      getProductionEventsModule(),
    ])
  }

  preload()
}

function getPdaMainTabModule(pathname: string): Promise<unknown> | null {
  const normalizedPathname = pathname.split('?')[0].split('#')[0]
  if (normalizedPathname === '/fcs/pda/task-receive') return getPdaTaskReceivePageModule()
  if (normalizedPathname === '/fcs/pda/exec') return getPdaExecPageModule()
  if (normalizedPathname === '/fcs/pda/handover') return getPdaHandoverPageModule()
  if (normalizedPathname === '/fcs/pda/warehouse') return getPdaWarehousePageModule()
  if (normalizedPathname === '/fcs/pda/settlement') return getPdaSettlementPageModule()
  return null
}

function preloadPdaMainTabModule(pathname: string): void {
  getPdaMainTabModule(pathname)?.catch((error) => {
    console.warn('PDA 主 Tab 预加载失败', error)
  })
}

function schedulePdaMainTabPreload(): void {
  if (pdaMainTabPreloadStarted) return
  pdaMainTabPreloadStarted = true

  window.setTimeout(() => {
    void Promise.allSettled([
      getPdaTaskReceivePageModule(),
      getPdaExecPageModule(),
      getPdaHandoverPageModule(),
      getPdaWarehousePageModule(),
      getPdaSettlementPageModule(),
    ])
  }, 0)
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
const browserSessionStorage = getBrowserSessionStorage()

function clearPreloadReloadFlag(): void {
  removeBrowserStorageItem(browserSessionStorage, PRELOAD_ERROR_RELOAD_KEY)
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
    const current = readBrowserStorageItem(browserSessionStorage, PRELOAD_ERROR_RELOAD_KEY)
    if (current) {
      const parsed = JSON.parse(current) as { path?: string; at?: number }
      const samePath = parsed.path === currentPath
      const recentlyReloaded = typeof parsed.at === 'number' && Date.now() - parsed.at < 30_000
      if (samePath && recentlyReloaded) return false
    }
    writeBrowserStorageItem(
      browserSessionStorage,
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
  const preloadEvent = event as Event & { payload?: unknown; detail?: unknown }
  const preloadError = preloadEvent.payload ?? preloadEvent.detail ?? event
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

async function dispatchPageEvent(target: Element, event?: Event): Promise<boolean> {
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

  if (pathname.startsWith('/fcs/dispatch/acceptance-sla')) {
    const dispatchAcceptanceSlaPage = await getDispatchAcceptanceSlaPageModule()
    return dispatchAcceptanceSlaPage.handleDispatchAcceptanceSlaEvent(eventTarget)
  }

  if (pathname.startsWith('/fcs/process/task-breakdown')) {
    const taskBreakdownPage = await getTaskBreakdownPageModule()
    return taskBreakdownPage.handleTaskBreakdownEvent(eventTarget)
  }
  if (pathname.startsWith('/fcs/process/water-soluble-orders')) {
    const page = await getProcessWaterSolubleOrdersPageModule()
    return page.handleProcessWaterSolubleOrdersEvent(eventTarget)
  }
  if (pathname.startsWith('/fcs/craft/dyeing/water-soluble-orders')) {
    const page = await getCraftDyeingWaterSolubleOrdersPageModule()
    return page.handleCraftDyeingWaterSolubleOrdersEvent(eventTarget)
  }
  if (
    pathname.startsWith('/fcs/progress/production-orders') ||
    pathname.startsWith('/fcs/production_order_track/index')
  ) {
    const productionOrderProgressTrackingPage = await getProductionOrderProgressTrackingPageModule()
    return productionOrderProgressTrackingPage.handleProductionOrderProgressEvent(eventTarget)
  }
  if (pathname.startsWith('/fcs/production/craft-dict')) {
    const fcsHandlers = await getFcsHandlersModule()
    return fcsHandlers.dispatchFcsPageEvent(eventTarget, event)
  }
  if (isProductionRoutePath(pathname)) {
    const productionEvents = await getProductionEventsModule()
    return productionEvents.handleProductionEvent(eventTarget, event)
  }
  if (pathname.startsWith('/fcs/progress/board')) {
    const progressBoardPage = await getProgressBoardPageModule()
    return progressBoardPage.handleProgressBoardEvent(eventTarget)
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
    return markerSpreadingPage.handleCraftCuttingMarkerSpreadingEvent(eventTarget, event)
  }
  if (pathname.startsWith('/fcs/craft/cutting/transfer-bags')) {
    const transferBagsPage = await getCraftCuttingTransferBagsPageModule()
    return transferBagsPage.handleCraftCuttingTransferBagsEvent(eventTarget, event)
  }
  if (
    pathname.startsWith('/fcs/craft/cutting/production-progress') ||
    pathname.startsWith('/fcs/craft/cutting/production-order-progress')
  ) {
    const productionProgressPage = await import('./pages/process-factory/cutting/production-progress')
    return productionProgressPage.handleCraftCuttingProductionProgressEvent(eventTarget, event)
  }
  if (pathname.startsWith('/fcs/craft/cutting/pickup-management')) {
    const fcsHandlers = await getFcsHandlersModule()
    return fcsHandlers.dispatchFcsPageEvent(eventTarget, event)
  }
  if (pathname.startsWith('/fcs/craft/cutting/supplement-management')) {
    const supplementManagementPage = await import('./pages/process-factory/cutting/supplement-management')
    return supplementManagementPage.handleCraftCuttingSupplementManagementEvent(eventTarget, event)
  }
  if (pathname.startsWith('/fcs/craft/cutting/cut-piece-return-processing')) {
    const cutPieceReturnPage = await import('./pages/process-factory/cutting/cut-piece-return-processing')
    return cutPieceReturnPage.handleCraftCuttingCutPieceReturnProcessingEvent(eventTarget, event)
  }
  if (pathname.startsWith('/wls/fabric-demand-board')) {
    try {
      const fabricDemandBoardPage = await getWlsFabricDemandBoardPageModule()
      return fabricDemandBoardPage.handleWlsFabricDemandBoardEvent(eventTarget)
    } catch (error) {
      if (reloadForDynamicModuleLoadError(error, '面料需求看板事件处理器')) return false
      console.error('面料需求看板事件处理器加载失败，已降级为不处理', error)
      return false
    }
  }
  const handlerSystem = getCurrentHandlerSystem(pathname)
  try {
    if (handlerSystem === 'pcs') {
      const pcsHandlers = await getPcsHandlersModule()
      return pcsHandlers.dispatchPcsPageEvent(eventTarget, event)
    }
    if (handlerSystem === 'fcs') {
      const fcsHandlers = await getFcsHandlersModule()
      return fcsHandlers.dispatchFcsPageEvent(eventTarget, event)
    }
    if (handlerSystem === 'pda') {
      const pdaHandlers = await getPdaHandlersModule()
      return pdaHandlers.dispatchPdaPageEvent(eventTarget, event)
    }

    const [fcsHandlers, pcsHandlers, pdaHandlers] = await Promise.all([
      getFcsHandlersModule(),
      getPcsHandlersModule(),
      getPdaHandlersModule(),
    ])

    if (await fcsHandlers.dispatchFcsPageEvent(eventTarget, event)) {
      return true
    }

    if (await pcsHandlers.dispatchPcsPageEvent(eventTarget, event)) {
      return true
    }

    return pdaHandlers.dispatchPdaPageEvent(eventTarget, event)
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

  if (isProductionRoutePath(pathname)) {
    const productionEvents = await getProductionEventsModule()
    return productionEvents.handleProductionSubmit(form)
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
  if (
    pathname.startsWith('/fcs/progress/production-orders') ||
    pathname.startsWith('/fcs/production_order_track/index')
  ) {
    const productionOrderProgressTrackingPage = await getProductionOrderProgressTrackingPageModule()
    return productionOrderProgressTrackingPage.closeProductionOrderProgressOverlay()
  }
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

  if (isProductionRoutePath(pathname)) {
    try {
      const productionDialogs = await getProductionDialogsModule()
      if (!productionDialogs.isProductionDialogOpen()) return false
      const productionEvents = await getProductionEventsModule()
      const fakeButton = document.createElement('button')
      fakeButton.dataset.prodAction = 'close-dialog'
      return productionEvents.handleProductionEvent(fakeButton)
    } catch (error) {
      if (reloadForDynamicModuleLoadError(error, '生产单弹窗处理器')) return false
      console.error('生产单弹窗处理器加载失败', error)
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

function isProductionRoutePath(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname)
  return normalizedPathname.startsWith('/fcs/production')
}

function isProductionScopedRenderPath(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname)
  return (
    normalizedPathname === '/fcs/production/demand-inbox' ||
    normalizedPathname === '/fcs/production/orders' ||
    /^\/fcs\/production\/orders\/[^/]+$/.test(normalizedPathname)
  )
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

const supplementManagementRoutePath = '/fcs/craft/cutting/supplement-management'
const cutPieceReturnProcessingRoutePath = '/fcs/craft/cutting/cut-piece-return-processing'
const productionPreparationTimingRoutePath = '/fcs/production/preparation-timing'
const productionPreparationTimingStatisticsRoutePath = '/fcs/production/preparation-timing-statistics'
let previousRenderedPagePathname = ''

async function preparePageRouteEntry(normalizedPathname: string): Promise<void> {
  const isSupplementManagementEntry =
    normalizedPathname === supplementManagementRoutePath &&
    previousRenderedPagePathname !== supplementManagementRoutePath
  const isCutPieceReturnProcessingEntry =
    normalizedPathname === cutPieceReturnProcessingRoutePath &&
    previousRenderedPagePathname !== cutPieceReturnProcessingRoutePath
  const isProductionPreparationTimingEntry =
    normalizedPathname === productionPreparationTimingRoutePath &&
    previousRenderedPagePathname !== productionPreparationTimingRoutePath
  const isProductionPreparationTimingStatisticsEntry =
    normalizedPathname === productionPreparationTimingStatisticsRoutePath &&
    previousRenderedPagePathname !== productionPreparationTimingStatisticsRoutePath
  previousRenderedPagePathname = normalizedPathname
  if (isSupplementManagementEntry) {
    const supplementManagementPage = await import('./pages/process-factory/cutting/supplement-management')
    supplementManagementPage.enterCraftCuttingSupplementManagementRoute()
  }
  if (isCutPieceReturnProcessingEntry) {
    const cutPieceReturnPage = await import('./pages/process-factory/cutting/cut-piece-return-processing')
    cutPieceReturnPage.enterCraftCuttingCutPieceReturnProcessingRoute()
  }
  if (!isProductionPreparationTimingEntry && !isProductionPreparationTimingStatisticsEntry) return

  const productionPreparationTimingPage = await import('./pages/production/preparation-timing')
  if (isProductionPreparationTimingEntry) productionPreparationTimingPage.enterProductionPreparationTimingRoute()
  if (isProductionPreparationTimingStatisticsEntry)
    productionPreparationTimingPage.enterProductionPreparationTimingStatisticsRoute()
}

async function renderCurrentPageContent(pathname: string): Promise<string> {
  try {
    const normalizedPathname = pathname.split('?')[0].split('#')[0]
    await preparePageRouteEntry(normalizedPathname)
    if (normalizedPathname === '/fcs/production/demand-inbox') {
      const productionDemandPage = await getProductionDemandPageModule()
      const page = productionDemandPage.renderProductionDemandInboxPage()
      scheduleProductionListPreload()
      return page
    }
    if (normalizedPathname === '/fcs/production/orders') {
      const productionOrdersPage = await getProductionOrdersPageModule()
      const page = productionOrdersPage.renderProductionOrdersPage()
      scheduleProductionListPreload()
      return page
    }
    if (normalizedPathname === '/fcs/pda/task-receive') {
      const pdaTaskReceivePage = await getPdaTaskReceivePageModule()
      return pdaTaskReceivePage.renderPdaTaskReceivePage()
    }
    if (normalizedPathname === '/fcs/pda/exec') {
      const pdaExecPage = await getPdaExecPageModule()
      return pdaExecPage.renderPdaExecPage()
    }
    if (normalizedPathname === '/fcs/pda/handover') {
      const pdaHandoverPage = await getPdaHandoverPageModule()
      return pdaHandoverPage.renderPdaHandoverPage()
    }
    if (normalizedPathname === '/fcs/pda/warehouse') {
      const pdaWarehousePage = await getPdaWarehousePageModule()
      return pdaWarehousePage.renderPdaWarehousePage()
    }
    if (normalizedPathname === '/fcs/pda/settlement') {
      const pdaSettlementPage = await getPdaSettlementPageModule()
      return pdaSettlementPage.renderPdaSettlementPage()
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

  if (state.pathname.startsWith('/fcs/') && !isPdaPath(state.pathname)) {
    preloadFcsHandlers()
  }
  ensureInitialPdaLoadingShell(state)
  const pageContentPromise = renderCurrentPageContent(state.pathname)
  const pageContent = isPdaPath(state.pathname)
    ? (await Promise.all([pageContentPromise, getPdaHandlersModule()]))[0]
    : await pageContentPromise
  if (currentSerial !== renderSerial) {
    return
  }

  root.innerHTML = renderAppShell(state, pageContent)
  if (isPdaPath(state.pathname)) {
    schedulePdaMainTabPreload()
    queueMicrotask(() => hydrateIcons(root))
  } else {
    hydrateIcons(root)
  }
  hydrateRealQRCodes(root)
  if (!dynamicModuleReloadScheduled) {
    clearPreloadReloadFlag()
  }
  scheduleProductionListPreload()
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

function shouldUseTechPackScopedRender(
  target: Element | null,
  previousPathname: string,
  nextPathname: string,
): boolean {
  if (!(target instanceof Element)) return false
  if (normalizePathname(previousPathname) !== normalizePathname(nextPathname)) return false
  const isTechPackTarget = Boolean(target.closest('[data-tech-pack-page-root="true"]'))
  const isCuttingMarkerTarget = Boolean(
    target.closest(
      [
        '[data-testid="cutting-marker-plan-list-page"]',
        '[data-testid="cutting-marker-plan-create-page"]',
        '[data-testid="cutting-marker-plan-edit-page"]',
        '[data-testid="cutting-marker-plan-detail-page"]',
      ].join(','),
    ),
  )
  if (!isTechPackTarget && !isCuttingMarkerTarget) return false

  const actionNode = target.closest<HTMLElement>('[data-tech-action]')
  const action = actionNode?.dataset.techAction
  if (action === 'tech-back') return false

  return true
}

function shouldUseProductionScopedRender(previousPathname: string, nextPathname: string): boolean {
  const previous = normalizePathname(previousPathname)
  const next = normalizePathname(nextPathname)
  return previous === next && isProductionScopedRenderPath(next)
}

function shouldUseProductionOrdersOverlayRender(
  target: Element | null,
  previousPathname: string,
  nextPathname: string,
): boolean {
  if (!(target instanceof Element)) return false
  const previous = normalizePathname(previousPathname)
  const next = normalizePathname(nextPathname)
  if (previous !== next || next !== '/fcs/production/orders') return false

  const actionNode = target.closest<HTMLElement>('[data-prod-action]')
  const action = actionNode?.dataset.prodAction || ''
  const overlayActions = new Set([
    'open-material-draft-drawer',
    'close-material-draft-drawer',
    'toggle-material-draft-needed',
    'toggle-material-draft-line',
    'open-add-draft-materials',
    'close-add-draft-materials',
    'toggle-add-draft-material',
    'add-draft-materials',
    'restore-material-draft-suggestion',
    'confirm-material-request-draft',
    'open-order-print-dialog',
    'close-order-print-dialog',
    'open-order-garment-replacement-dialog',
    'close-order-garment-replacement-dialog',
    'toggle-order-print-select-all',
    'toggle-order-print-select',
    'reset-order-print-qty',
    'print-order-sku-barcode',
    'print-order-sku-hangtag',
    'print-order-selected-barcode',
    'print-order-selected-hangtag',
  ])
  if (overlayActions.has(action)) return true

  const fieldNode = target.closest<HTMLElement>('[data-prod-field]')
  const field = fieldNode?.dataset.prodField || ''
  return (
    field.startsWith('materialDraftMode:') ||
    field.startsWith('materialDraftRemark:') ||
    field.startsWith('materialDraftLineQty:')
  )
}

function shouldUseProductionDemandOverlayRender(
  target: Element | null,
  previousPathname: string,
  nextPathname: string,
): boolean {
  if (!(target instanceof Element)) return false
  const previous = normalizePathname(previousPathname)
  const next = normalizePathname(nextPathname)
  if (previous !== next || next !== '/fcs/production/demand-inbox') return false

  const actionNode = target.closest<HTMLElement>('[data-prod-action]')
  const action = actionNode?.dataset.prodAction || ''
  const overlayActions = new Set([
    'open-demand-detail',
    'close-demand-detail',
    'open-demand-batch',
    'open-demand-merge',
    'open-demand-single',
    'close-demand-generate',
  ])
  if (overlayActions.has(action)) return true

  const fieldNode = target.closest<HTMLElement>('[data-prod-field]')
  const field = fieldNode?.dataset.prodField || ''
  return field.startsWith('demandGenerateTechPackVersion:')
}

function shouldUseProductionDemandConfirmOverlayRender(
  target: Element | null,
  previousPathname: string,
  nextPathname: string,
): boolean {
  if (!(target instanceof Element)) return false
  const previous = normalizePathname(previousPathname)
  const next = normalizePathname(nextPathname)
  if (previous !== next || next !== '/fcs/production/demand-inbox') return false

  const actionNode = target.closest<HTMLElement>('[data-prod-action]')
  const action = actionNode?.dataset.prodAction || ''
  return action === 'open-demand-generate-confirm' || action === 'close-demand-generate-confirm'
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
    selectorParts.push(`[${datasetKeyToAttribute(key)}="${escapeCssValue(value || '')}"]`)
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
    const parentElement: HTMLElement | null = current.parentElement
    if (!parentElement) break
    const index = Array.prototype.indexOf.call(parentElement.children, current)
    path.unshift(index)
    current = parentElement
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

async function renderProductionOrdersOverlayOnly(snapshot: FocusSnapshot | null = null): Promise<void> {
  const host = root.querySelector('[data-production-orders-overlay-root="true"]')
  if (!(host instanceof HTMLElement)) {
    await renderPageContentOnlyWithFocusRestore(snapshot)
    return
  }

  const productionOrdersPage = await getProductionOrdersPageModule()
  host.innerHTML = `${productionOrdersPage.renderMaterialDraftDrawer()}${productionOrdersPage.renderOrderPrintDialog()}${productionOrdersPage.renderOrderGarmentReplacementDialog()}`
  hydrateRealQRCodes(host)
  queueMicrotask(() => {
    hydrateIcons(host)
    restoreFocusSnapshot(snapshot)
  })
}

async function renderProductionDemandOverlayOnly(snapshot: FocusSnapshot | null = null): Promise<void> {
  const host = root.querySelector('[data-production-demand-overlay-root="true"]')
  if (!(host instanceof HTMLElement)) {
    await renderPageContentOnlyWithFocusRestore(snapshot)
    return
  }

  const productionDemandPage = await getProductionDemandPageModule()
  host.innerHTML = productionDemandPage.renderProductionDemandOverlays()
  hydrateRealQRCodes(host)
  queueMicrotask(() => {
    hydrateIcons(host)
    restoreFocusSnapshot(snapshot)
  })
}

async function renderProductionDemandConfirmOverlayOnly(snapshot: FocusSnapshot | null = null): Promise<void> {
  const host = root.querySelector('[data-production-demand-confirm-root="true"]')
  if (!(host instanceof HTMLElement)) {
    await renderProductionDemandOverlayOnly(snapshot)
    return
  }

  const productionDemandPage = await getProductionDemandPageModule()
  host.innerHTML = productionDemandPage.renderDemandConfirmDialog()
  hydrateRealQRCodes(host)
  queueMicrotask(() => {
    hydrateIcons(host)
    restoreFocusSnapshot(snapshot)
  })
}

function closeMobileSidebar(): void {
  const { sidebarOpen } = appStore.getState()
  if (sidebarOpen) {
    markNextStoreRenderAsSidebarOnly()
    appStore.setSidebarOpen(false)
  }
}

function navigateWithImmediateSidebar(pathname: string): void {
  const currentPathname = appStore.getState().pathname
  if (isPdaPath(currentPathname) || isPdaPath(pathname)) {
    preloadPdaMainTabModule(pathname)
    appStore.navigate(pathname)
    return
  }

  if (isStandalonePrintPath(currentPathname) !== isStandalonePrintPath(pathname)) {
    appStore.navigate(pathname)
    return
  }

  markNextStoreRenderAsSidebarOnly()
  appStore.navigate(pathname)
  closeMobileSidebar()
  void renderPageContentOnly()
}

function buildNavigationFromFields(node: HTMLElement): string | null {
  const scopeSelector = node.dataset.navFromFields
  if (!scopeSelector) return null
  const scope = node.closest<HTMLElement>(scopeSelector)
  if (!scope) return null

  const params = new URLSearchParams()
  scope
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input[name], select[name], textarea[name]',
    )
    .forEach((field) => {
      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        if (!field.checked) return
        const value = field.value.trim()
        if (value) params.append(field.name, value)
        return
      }
      if (field instanceof HTMLInputElement && field.type === 'radio' && !field.checked) return
      const value = field.value.trim()
      if (value) params.set(field.name, value)
    })
  scope.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((details) => {
    details.open = false
  })
  if (node.dataset.navResetPage !== 'false') params.set('page', '1')

  const base = node.dataset.navBase || window.location.pathname
  const query = params.toString()
  const hash = node.dataset.navHash ? `#${node.dataset.navHash.replace(/^#/, '')}` : ''
  return `${base}${query ? `?${query}` : ''}${hash}`
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

type RerenderEventKind = 'input' | 'change'

const RERENDER_DRIVEN_INPUT_TYPES = new Set(['checkbox', 'radio', 'file', 'range', 'color'])
const TECH_CHANGE_RERENDER_DRIVEN_FIELDS = new Set([
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
const MARKER_PLAN_INPUT_SELECTOR = [
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
].join(', ')

function isInputOrTextArea(node: HTMLElement | null): node is HTMLInputElement | HTMLTextAreaElement {
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
}

function getInputType(node: HTMLInputElement | HTMLTextAreaElement): string {
  return node instanceof HTMLInputElement ? (node.type || 'text').toLowerCase() : 'text'
}

function shouldSkipRerenderForControlType(node: HTMLInputElement | HTMLTextAreaElement): boolean {
  return !RERENDER_DRIVEN_INPUT_TYPES.has(getInputType(node))
}

function resolveSharedFieldRerenderDecision(target: Element, eventKind: RerenderEventKind): boolean | undefined {
  const pdaLoginFieldNode = target.closest<HTMLElement>('[data-pda-login-field]')
  if (isInputOrTextArea(pdaLoginFieldNode)) return true

  const productionFieldNode = target.closest<HTMLElement>('[data-prod-field]')
  if (isInputOrTextArea(productionFieldNode)) return shouldSkipRerenderForControlType(productionFieldNode)

  const pdaCutHandoverFieldNode = target.closest<HTMLElement>('[data-pda-cut-handover-field]')
  if (isInputOrTextArea(pdaCutHandoverFieldNode)) return true

  const pdaCutSpreadingFieldNode = target.closest<HTMLElement>(
    '[data-pda-cut-spreading-field], [data-pda-cut-spreading-operator-field]',
  )
  if (
    isInputOrTextArea(pdaCutSpreadingFieldNode) ||
    (eventKind === 'change' && pdaCutSpreadingFieldNode instanceof HTMLSelectElement)
  ) {
    return true
  }

  if (eventKind === 'input') {
    const markerPlanInputNode = target.closest<HTMLElement>(MARKER_PLAN_INPUT_SELECTOR)
    if (isInputOrTextArea(markerPlanInputNode)) {
      const inputType = getInputType(markerPlanInputNode)
      return inputType !== 'checkbox' && inputType !== 'radio'
    }
  }

  const pdaOnboardingFieldNode = target.closest<HTMLElement>(
    '[data-pda-onboarding-field], [data-pda-onboarding-machine-field]',
  )
  if (isInputOrTextArea(pdaOnboardingFieldNode)) return true

  const factoryOnboardingFieldNode = target.closest<HTMLElement>('[data-factory-onboarding-field]')
  if (isInputOrTextArea(factoryOnboardingFieldNode)) {
    const inputType = getInputType(factoryOnboardingFieldNode)
    return inputType !== 'radio' && inputType !== 'checkbox'
  }

  const factoryProfileFieldNode = target.closest<HTMLElement>('[data-factory-field], [data-pda-field]')
  if (isInputOrTextArea(factoryProfileFieldNode)) return shouldSkipRerenderForControlType(factoryProfileFieldNode)

  return undefined
}

function shouldSkipInputRerender(target: Element): boolean {
  if (target.closest<HTMLElement>('[data-skip-page-rerender="true"]')) return true
  if (target.closest<HTMLElement>('[data-review-ui-field]')) return true

  const techFieldNode = target.closest<HTMLElement>('[data-tech-field]')
  if (techFieldNode) {
    const field = techFieldNode.dataset.techField || ''
    if (field === 'pattern-template-search-keyword') return false
    if (field === 'new-pattern-piece-color-count') return false

    if (techFieldNode instanceof HTMLTextAreaElement) return true

    if (techFieldNode instanceof HTMLInputElement) {
      return shouldSkipRerenderForControlType(techFieldNode)
    }

    return false
  }

  return resolveSharedFieldRerenderDecision(target, 'input') ?? false
}

function shouldSkipChangeRerender(target: Element): boolean {
  if (target.closest<HTMLElement>('[data-skip-page-rerender="true"]')) return true

  const techFieldNode = target.closest<HTMLElement>('[data-tech-field]')
  if (techFieldNode) {
    const field = techFieldNode.dataset.techField || ''
    return !TECH_CHANGE_RERENDER_DRIVEN_FIELDS.has(field)
  }

  return resolveSharedFieldRerenderDecision(target, 'change') ?? false
}

async function renderAfterHandledPageEvent(
  target: HTMLElement,
  focusSnapshot: FocusSnapshot | null,
  previousPathname: string,
): Promise<void> {
  const nextPathname = appStore.getState().pathname
  if (shouldUseProductionDemandConfirmOverlayRender(target, previousPathname, nextPathname)) {
    await renderProductionDemandConfirmOverlayOnly(focusSnapshot)
    return
  }
  if (shouldUseProductionDemandOverlayRender(target, previousPathname, nextPathname)) {
    await renderProductionDemandOverlayOnly(focusSnapshot)
    return
  }
  if (shouldUseProductionOrdersOverlayRender(target, previousPathname, nextPathname)) {
    await renderProductionOrdersOverlayOnly(focusSnapshot)
    return
  }
  if (
    target.closest<HTMLElement>('[data-fast-page-render]') ||
    shouldUseTechPackScopedRender(target, previousPathname, nextPathname) ||
    shouldUseProductionScopedRender(previousPathname, nextPathname)
  ) {
    await renderPageContentOnlyWithFocusRestore(focusSnapshot)
  } else {
    await renderWithFocusRestore(focusSnapshot)
  }
}

function resolveEventElementTarget(eventTarget: EventTarget | null): HTMLElement | null {
  if (eventTarget instanceof HTMLElement) return eventTarget
  if (eventTarget instanceof Element) return eventTarget.parentElement
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

const STANDARD_LIST_COLUMN_DRAG_MIME = 'application/x-higood-list-column-key'

interface StandardListColumnDragEvent extends DragEvent {
  higoodStandardListColumnDrag?: true
  higoodStandardListColumnKey?: string
}

let activeStandardListColumnDrag: { columnKey: string; pathname: string } | null = null

function dispatchListColumnDragEvent(event: DragEvent): void {
  const target = resolveEventElementTarget(event.target)
  const dragNode = target?.closest<HTMLElement>('[data-standard-list-column-drag]')
  const dataTransfer = event.dataTransfer
  const pathname = appStore.getState().pathname

  if (event.type === 'dragstart') {
    const columnKey = dragNode?.dataset.dragSource || ''
    if (!target || !dragNode || !dataTransfer || !columnKey) return
    activeStandardListColumnDrag = { columnKey, pathname }
    dataTransfer.setData(STANDARD_LIST_COLUMN_DRAG_MIME, columnKey)
    dataTransfer.effectAllowed = 'move'
  } else {
    const activeDrag = activeStandardListColumnDrag
    if (!target || !activeDrag || activeDrag.pathname !== pathname) {
      if (event.type === 'dragend') activeStandardListColumnDrag = null
      return
    }

    if (event.type === 'dragover' || event.type === 'drop') {
      const hasInternalMime = Array.from(dataTransfer?.types ?? []).includes(STANDARD_LIST_COLUMN_DRAG_MIME)
      if (!dragNode || !hasInternalMime) return
      event.preventDefault()
      if (dataTransfer) dataTransfer.dropEffect = 'move'
    }
  }

  const internalEvent = event as StandardListColumnDragEvent
  internalEvent.higoodStandardListColumnDrag = true
  internalEvent.higoodStandardListColumnKey = activeStandardListColumnDrag?.columnKey
  if (event.type === 'drop' || event.type === 'dragend') activeStandardListColumnDrag = null
  void dispatchPageEvent(target, internalEvent)
}

root.addEventListener('dragstart', dispatchListColumnDragEvent)
root.addEventListener('dragover', dispatchListColumnDragEvent)
root.addEventListener('drop', dispatchListColumnDragEvent)
root.addEventListener('dragend', dispatchListColumnDragEvent)

root.addEventListener('click', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return
  const skipPageRerender = Boolean(
    target.closest<HTMLElement>('[data-skip-page-rerender="true"], [data-review-ui-action]'),
  )
  const preserveNativeClick = Boolean(target.closest<HTMLInputElement>('input[data-preserve-native-click="true"]'))
  const focusSnapshot = captureFocusSnapshot()
  const previousPathname = appStore.getState().pathname

  if (shouldBypassClickDispatch(target)) return

  if (handlePdaImagePreviewEvent(target)) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  const productionObjectActionNode = target.closest<HTMLElement>('[data-production-object-action]')
  if (productionObjectActionNode) {
    if (handleProductionObjectFloatingEntryEvent(productionObjectActionNode)) {
      event.preventDefault()
      return
    }
    const productionObjectOverview = await getProductionObjectOverviewModule()
    if (productionObjectOverview.handleProductionObjectOverviewEvent(productionObjectActionNode)) {
      event.preventDefault()
      return
    }
  }

  const shellActionNode = target.closest<HTMLElement>('[data-action]')
  if (shellActionNode && handleShellAction(shellActionNode)) {
    event.preventDefault()
    return
  }

  const warehouseSharedNode = target.closest<HTMLElement>(
    '[data-warehouse-flow-action], [data-factory-warehouse-location-action]',
  )
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
    const inboundModule = await getPdaCuttingInboundModule()
    const inboundResult = inboundModule.handlePdaCuttingInboundEvent(pdaCutInboundActionNode)
    if (inboundResult) {
      if (isPdaPageHandledLocally(inboundResult)) return
      await renderWithFocusRestore(focusSnapshot)
      return
    }
  }

  const pdaCutHandoverActionNode = target.closest<HTMLElement>('[data-pda-cut-handover-action]')
  if (pdaCutHandoverActionNode) {
    event.preventDefault()
    const handoverModule = await getPdaCuttingHandoverModule()
    const handoverResult = handoverModule.handlePdaCuttingHandoverEvent(pdaCutHandoverActionNode)
    if (handoverResult) {
      if (isPdaPageHandledLocally(handoverResult)) return
      await renderWithFocusRestore(focusSnapshot)
      return
    }
  }

  const pdaTicketNumberingActionNode = target.closest<HTMLElement>('[data-pda-ticket-numbering-action]')
  if (pdaTicketNumberingActionNode) {
    event.preventDefault()
    const pdaTicketNumberingPage = await import('./pages/pda-cutting-fei-ticket-numbering')
    if (pdaTicketNumberingPage.handlePdaCuttingFeiTicketNumberingEvent(pdaTicketNumberingActionNode)) {
      await renderWithFocusRestore(focusSnapshot)
      return
    }
  }

  const fieldDrivenNavNode = target.closest<HTMLElement>('[data-nav-from-fields]')
  const fieldDrivenPath = fieldDrivenNavNode ? buildNavigationFromFields(fieldDrivenNavNode) : null
  if (fieldDrivenPath) {
    event.preventDefault()
    navigateWithImmediateSidebar(fieldDrivenPath)
    return
  }

  const directNavNode = target.closest<HTMLElement>('[data-nav]')
  if (directNavNode?.dataset.nav && !hasDatasetAction(directNavNode)) {
    event.preventDefault()
    navigateWithImmediateSidebar(directNavNode.dataset.nav)
    return
  }

  const pageEventHandled = await dispatchPageEvent(target, event)
  if (pageEventHandled) {
    // Checkbox/radio actions read the browser's already-toggled state. Cancelling
    // that click would roll the native control back after the local handler ran.
    if (!preserveNativeClick) event.preventDefault()
    if (skipPageRerender) {
      return
    }
    const nextPathname = appStore.getState().pathname
    if (shouldUseProductionDemandConfirmOverlayRender(target, previousPathname, nextPathname)) {
      await renderProductionDemandConfirmOverlayOnly(focusSnapshot)
      return
    }
    if (shouldUseProductionDemandOverlayRender(target, previousPathname, nextPathname)) {
      await renderProductionDemandOverlayOnly(focusSnapshot)
      return
    }
    if (shouldUseProductionOrdersOverlayRender(target, previousPathname, nextPathname)) {
      await renderProductionOrdersOverlayOnly(focusSnapshot)
      return
    }
    if (
      target.closest<HTMLElement>('[data-fast-page-render]') ||
      shouldUseTechPackScopedRender(target, previousPathname, nextPathname) ||
      shouldUseProductionScopedRender(previousPathname, nextPathname)
    ) {
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
  // 工程成果文件只在 change 中读取。首次操作即选文件时，避免异步加载处理器期间
  // input 与 change 竞争，导致文件控件被提前重绘或同一文件被保存两次。
  if (target.closest<HTMLInputElement>('[data-engineering-upload-region] input[type="file"]')) return
  if (isComposingInputEvent(event)) return
  const focusSnapshot = captureFocusSnapshot()
  const previousPathname = appStore.getState().pathname

  const productionObjectActionNode = target.closest<HTMLElement>('[data-production-object-action]')
  if (productionObjectActionNode) {
    if (handleProductionObjectFloatingEntryEvent(productionObjectActionNode)) return
    const productionObjectOverview = await getProductionObjectOverviewModule()
    if (productionObjectOverview.handleProductionObjectOverviewEvent(productionObjectActionNode)) return
  }

  const pdaCuttingInputResult = await handleActivePdaCuttingEvent(target, event)
  if (pdaCuttingInputResult) return

  if (await dispatchPcsInputEvent(target)) {
    if (shouldSkipInputRerender(target)) return
    await renderWithFocusRestore(focusSnapshot)
    return
  }

  const pageEventHandled = await dispatchPageEvent(target, event)
  if (pageEventHandled) {
    if (shouldSkipInputRerender(target)) return
    await renderAfterHandledPageEvent(target, focusSnapshot, previousPathname)
  }
})

root.addEventListener('compositionend', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return
  const focusSnapshot = captureFocusSnapshot()
  const previousPathname = appStore.getState().pathname

  if (await dispatchPcsInputEvent(target)) {
    if (shouldSkipInputRerender(target)) return
    await renderWithFocusRestore(focusSnapshot)
    return
  }

  if (await dispatchPageEvent(target, event)) {
    if (shouldSkipInputRerender(target)) return
    await renderAfterHandledPageEvent(target, focusSnapshot, previousPathname)
  }
})

root.addEventListener('change', async (event) => {
  const target = resolveEventElementTarget(event.target)
  if (!target) return
  const skipChangeRerender = shouldSkipChangeRerender(target)
  const focusSnapshot = captureFocusSnapshot()
  const previousPathname = appStore.getState().pathname

  if (
    target.closest<HTMLInputElement>('[data-engineering-upload-region] input[type="file"]') &&
    (await dispatchPcsInputEvent(target))
  ) {
    return
  }

  if (await dispatchPageEvent(target, event)) {
    if (skipChangeRerender) return
    await renderAfterHandledPageEvent(target, focusSnapshot, previousPathname)
  }
})

root.addEventListener('submit', async (event) => {
  const target = event.target
  if (!(target instanceof HTMLFormElement)) return

  event.preventDefault()
  if (await dispatchPageSubmit(target)) {
    await render()
  }
})

document.addEventListener('keydown', async (event) => {
  const target = resolveEventElementTarget(event.target)
  const cuttingScanTarget = resolvePdaCuttingScanKeydownTarget<HTMLElement>(target, event.key)
  if (cuttingScanTarget) {
    const scanResult = await handleActivePdaCuttingEvent(cuttingScanTarget, event)
    if (scanResult) event.preventDefault()
    return
  }
  const scanEnterTarget =
    event.key === 'Enter'
      ? target?.closest<HTMLElement>('[data-pda-scan-enter="true"], [data-scan-enter="true"]')
      : null
  if (scanEnterTarget) {
    const focusSnapshot = captureFocusSnapshot()
    if (await dispatchPageEvent(scanEnterTarget, event)) {
      event.preventDefault()
      await renderWithFocusRestore(focusSnapshot)
    }
    return
  }
  if (event.key !== 'Escape') return

  if (closePdaImagePreview()) {
    event.preventDefault()
    return
  }

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
scheduleProductionListPreload()
void render()
