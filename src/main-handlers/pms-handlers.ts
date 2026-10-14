type HandlerModule = Record<string, unknown>

interface PmsHandlerSpec {
  cacheKey: string
  matches: (pathname: string) => boolean
  importModule: () => Promise<HandlerModule>
  eventExport?: string
  closeExport?: string
}

const handlerModuleCache = new Map<string, Promise<HandlerModule>>()

const PMS_HANDLER_SPECS: PmsHandlerSpec[] = [
  {
    cacheKey: 'pms-purchase-suggestions',
    matches: (pathname) => pathname === '/pms/purchase-suggestions',
    importModule: () => import('../pages/pms/purchase-suggestions'),
    eventExport: 'handlePmsPurchaseSuggestionsEvent',
    closeExport: 'closePmsPurchaseSuggestionsOverlays',
  },
  {
    cacheKey: 'pms-kol-demands',
    matches: (pathname) => pathname === '/pms/kol-demands',
    importModule: () => import('../pages/pms/kol-demands'),
    eventExport: 'handlePmsKolDemandsEvent',
    closeExport: 'closePmsKolDemandsOverlays',
  },
  {
    cacheKey: 'pms-product-purchase-orders',
    matches: (pathname) => pathname === '/pms/product-purchase-orders',
    importModule: () => import('../pages/pms/product-purchase-orders'),
    eventExport: 'handlePmsProductPurchaseOrdersEvent',
    closeExport: 'closePmsProductPurchaseOrderOverlays',
  },
  {
    cacheKey: 'pms-reorder-suggestions',
    matches: (pathname) => pathname === '/pms/reorder',
    importModule: () => import('../pages/pms/reorder-suggestions'),
    eventExport: 'handlePmsReorderSuggestionsEvent',
    closeExport: 'closePmsReorderSuggestionsOverlays',
  },
  {
    cacheKey: 'pms-purchase-order-aftersales',
    matches: (pathname) => pathname === '/pms/product-purchase-order-aftersales',
    importModule: () => import('../pages/pms/purchase-order-aftersales'),
    eventExport: 'handlePmsPurchaseOrderAftersalesEvent',
    closeExport: 'closePmsPurchaseOrderAftersalesOverlays',
  },
  {
    cacheKey: 'pms-material-requirements',
    matches: (pathname) => pathname === '/pms/material-requirements',
    importModule: () => import('../pages/pms/material-requirements'),
    eventExport: 'handlePmsMaterialRequirementsEvent',
    closeExport: 'closePmsMaterialRequirementOverlays',
  },
  {
    cacheKey: 'pms-material-purchase-orders',
    matches: (pathname) => pathname === '/pms/material-purchase-orders',
    importModule: () => import('../pages/pms/material-purchase-orders'),
    eventExport: 'handlePmsMaterialPurchaseOrdersEvent',
    closeExport: 'closePmsMaterialPurchaseOrderOverlays',
  },
  {
    cacheKey: 'pms-material-purchase-tracking',
    matches: (pathname) => pathname === '/pms/material-purchase-tracking',
    importModule: () => import('../pages/pms/material-purchase-tracking'),
    eventExport: 'handlePmsMaterialPurchaseTrackingEvent',
    closeExport: 'closePmsMaterialPurchaseTrackingOverlays',
  },
  {
    cacheKey: 'pms-supplier-confirmations',
    matches: (pathname) => pathname === '/pms/material-supplier-confirmations',
    importModule: () => import('../pages/pms/supplier-confirmations'),
    eventExport: 'handlePmsSupplierConfirmationsEvent',
    closeExport: 'closePmsSupplierConfirmationOverlays',
  },
  {
    cacheKey: 'pms-first-leg-shipments',
    matches: (pathname) => pathname === '/pms/first-leg-shipments',
    importModule: () => import('../pages/pms/first-leg-shipments'),
    eventExport: 'handlePmsFirstLegShipmentsEvent',
    closeExport: 'closePmsFirstLegShipmentOverlays',
  },
  {
    cacheKey: 'pms-first-leg-carriers',
    matches: (pathname) => pathname === '/pms/first-leg-carriers',
    importModule: () => import('../pages/pms/first-leg-carriers'),
    eventExport: 'handlePmsFirstLegCarriersEvent',
    closeExport: 'closePmsFirstLegCarrierOverlays',
  },
  {
    cacheKey: 'pms-suppliers',
    matches: (pathname) => pathname === '/pms/suppliers',
    importModule: () => import('../pages/pms/suppliers'),
    eventExport: 'handlePmsSuppliersEvent',
    closeExport: 'closePmsSupplierOverlays',
  },
  {
    cacheKey: 'pms-supply-archives',
    matches: (pathname) => pathname === '/pms/supplier-supply-archives',
    importModule: () => import('../pages/pms/supplier-supply-archives'),
    eventExport: 'handlePmsSupplyArchivesEvent',
    closeExport: 'closePmsSupplyArchiveOverlays',
  },
  {
    cacheKey: 'pms-payment-requests',
    matches: (pathname) => pathname === '/pms/material-payment-requests' || pathname === '/pms/logistics-payment-requests',
    importModule: () => import('../pages/pms/payment-requests'),
    eventExport: 'handlePmsPaymentRequestsEvent',
    closeExport: 'closePmsPaymentRequestOverlays',
  },
  {
    cacheKey: 'pms-material-inventory',
    matches: (pathname) => pathname === '/pms/material-inventory',
    importModule: () => import('../pages/pms/material-inventory'),
    eventExport: 'handlePmsMaterialInventoryEvent',
    closeExport: 'closePmsInventoryOverlays',
  },
  {
    cacheKey: 'pms-fitting-timeliness',
    matches: (pathname) => pathname === '/pms/fitting-timeliness',
    importModule: () => import('../pages/pms/fitting-timeliness'),
    eventExport: 'handlePmsFittingTimelinessEvent',
    closeExport: 'closePmsFittingTimelinessOverlays',
  },
  {
    cacheKey: 'pms-kol-sample-stock',
    matches: (pathname) => pathname === '/pms/kol-sample-stock',
    importModule: () => import('../pages/pms/kol-sample-stock'),
    eventExport: 'handlePmsKolStockEvent',
    closeExport: 'closePmsKolStockOverlays',
  },
  {
    cacheKey: 'pms-kol-sample-apply',
    matches: (pathname) => pathname === '/pms/kol-sample-apply',
    importModule: () => import('../pages/pms/kol-sample-apply'),
    eventExport: 'handlePmsKolApplyEvent',
    closeExport: 'closePmsKolApplyOverlays',
  },
  {
    cacheKey: 'pms-kol-sample-link',
    matches: (pathname) => pathname === '/pms/kol-sample-link',
    importModule: () => import('../pages/pms/kol-sample-link'),
    eventExport: 'handlePmsKolLinkEvent',
    closeExport: 'closePmsKolLinkOverlays',
  },
  {
    cacheKey: 'pms-kol-sample-stock-lock-log',
    matches: (pathname) => pathname === '/pms/kol-sample-stock/lock-log',
    importModule: () => import('../pages/pms/kol-sample-stock-lock-log'),
    eventExport: 'handlePmsKolLockLogEvent',
    closeExport: 'closePmsKolLockLogOverlays',
  },
]

function currentPathname(): string {
  return window.location.pathname || ''
}

function findHandlerSpec(pathname: string): PmsHandlerSpec | undefined {
  return PMS_HANDLER_SPECS.find((spec) => spec.matches(pathname))
}

async function loadHandlerModule(spec: PmsHandlerSpec): Promise<HandlerModule> {
  const cached = handlerModuleCache.get(spec.cacheKey)
  if (cached) return cached
  const modulePromise = spec.importModule().catch((error) => {
    handlerModuleCache.delete(spec.cacheKey)
    throw error
  })
  handlerModuleCache.set(spec.cacheKey, modulePromise)
  return modulePromise
}

export async function dispatchPmsPageEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const spec = findHandlerSpec(currentPathname())
  if (!spec?.eventExport) return false
  const module = await loadHandlerModule(spec)
  const handler = module[spec.eventExport]
  if (typeof handler !== 'function') return false
  const handled = Boolean(await (handler as (target: HTMLElement, event?: Event) => unknown)(target, event))
  if (handled) target.dataset.pmsEventHandledLocally = 'true'
  return handled
}

export async function closePmsDialogsOnEscape(): Promise<boolean> {
  const spec = findHandlerSpec(currentPathname())
  if (!spec?.closeExport) return false
  const module = await loadHandlerModule(spec)
  const closer = module[spec.closeExport]
  if (typeof closer !== 'function') return false
  return Boolean(await (closer as () => unknown)())
}
