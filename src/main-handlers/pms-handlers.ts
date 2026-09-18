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
    cacheKey: 'pms-workbench',
    matches: (pathname) => pathname === '/pms/workbench/overview',
    importModule: () => import('../pages/pms/workbench'),
    eventExport: 'handlePmsWorkbenchEvent',
  },
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
    cacheKey: 'pms-trade-subjects',
    matches: (pathname) => pathname === '/pms/trade-subjects',
    importModule: () => import('../pages/pms/trade-subjects'),
    eventExport: 'handlePmsTradeSubjectsEvent',
    closeExport: 'closePmsTradeSubjectOverlays',
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
    cacheKey: 'pms-material-archives',
    matches: (pathname) => pathname === '/pms/material-archives',
    importModule: () => import('../pages/pms/material-archives'),
    eventExport: 'handlePmsMaterialArchivesEvent',
    closeExport: 'closePmsMaterialArchiveOverlays',
  },
  {
    cacheKey: 'pms-product-skus',
    matches: (pathname) => pathname === '/pms/garment-skus' || pathname === '/pms/sample-skus',
    importModule: () => import('../pages/pms/product-skus'),
    eventExport: 'handlePmsProductSkusEvent',
    closeExport: 'closePmsProductSkuOverlays',
  },
  {
    cacheKey: 'pms-warehouses',
    matches: (pathname) => pathname === '/pms/warehouses',
    importModule: () => import('../pages/pms/warehouses'),
    eventExport: 'handlePmsWarehousesEvent',
    closeExport: 'closePmsWarehouseOverlays',
  },
  {
    cacheKey: 'pms-units',
    matches: (pathname) => pathname === '/pms/units',
    importModule: () => import('../pages/pms/units'),
    eventExport: 'handlePmsUnitsEvent',
    closeExport: 'closePmsUnitOverlays',
  },
  {
    cacheKey: 'pms-bom-templates',
    matches: (pathname) => pathname === '/pms/bom-templates',
    importModule: () => import('../pages/pms/bom-templates'),
    eventExport: 'handlePmsBomTemplatesEvent',
    closeExport: 'closePmsBomTemplateOverlays',
  },
  {
    cacheKey: 'pms-bom-detail',
    matches: (pathname) => /^\/pms\/bom-templates\/[^/]+$/.test(pathname),
    importModule: () => import('../pages/pms/bom-detail'),
    eventExport: 'handlePmsBomDetailEvent',
  },
  {
    cacheKey: 'pms-subject-operations',
    matches: (pathname) => pathname === '/pms/subject-operations',
    importModule: () => import('../pages/pms/subject-operations'),
    eventExport: 'handlePmsSubjectOperationsEvent',
    closeExport: 'closePmsSubjectOperationOverlays',
  },
  {
    cacheKey: 'pms-material-reconciliations',
    matches: (pathname) => pathname === '/pms/material-reconciliations',
    importModule: () => import('../pages/pms/material-reconciliations'),
    eventExport: 'handlePmsMaterialReconciliationsEvent',
    closeExport: 'closePmsMaterialReconciliationOverlays',
  },
  {
    cacheKey: 'pms-logistics-reconciliations',
    matches: (pathname) => pathname === '/pms/logistics-reconciliations',
    importModule: () => import('../pages/pms/logistics-reconciliations'),
    eventExport: 'handlePmsLogisticsReconciliationsEvent',
    closeExport: 'closePmsLogisticsReconciliationOverlays',
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
    cacheKey: 'pms-transit-dashboard',
    matches: (pathname) => pathname === '/pms/transit/dashboard',
    importModule: () => import('../pages/pms/transit-dashboard'),
    eventExport: 'handlePmsTransitDashboardEvent',
  },
  {
    cacheKey: 'pms-transit-receipts',
    matches: (pathname) => pathname === '/pms/transit/receipts',
    importModule: () => import('../pages/pms/transit-receipts'),
    eventExport: 'handlePmsTransitReceiptsEvent',
    closeExport: 'closePmsTransitReceiptOverlays',
  },
  {
    cacheKey: 'pms-transit-simple-lists',
    matches: (pathname) => pathname === '/pms/transit/order-checks' || pathname === '/pms/transit/preparation-tasks',
    importModule: () => import('../pages/pms/transit-simple-lists'),
    eventExport: 'handlePmsTransitSimpleListEvent',
    closeExport: 'closePmsTransitSimpleListOverlays',
  },
  {
    cacheKey: 'pms-settings',
    matches: (pathname) => pathname === '/pms/users' || pathname === '/pms/roles' || pathname === '/pms/dictionaries',
    importModule: () => import('../pages/pms/settings'),
    eventExport: 'handlePmsSettingsEvent',
    closeExport: 'closePmsSettingsOverlays',
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
  return Boolean((handler as (target: HTMLElement, event?: Event) => unknown)(target, event))
}

export async function closePmsDialogsOnEscape(): Promise<boolean> {
  const spec = findHandlerSpec(currentPathname())
  if (!spec?.closeExport) return false
  const module = await loadHandlerModule(spec)
  const closer = module[spec.closeExport]
  if (typeof closer !== 'function') return false
  return Boolean((closer as () => unknown)())
}
