import { appStore } from '../../../state/store.ts'

export interface WarehouseNavigationPayload {
  cutOrders: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  summary: Record<string, string | undefined>
  transferBags: Record<string, string | undefined>
}

export function buildWarehouseQueryPayload(options: {
  cutOrderNo?: string
  cutOrderId?: string
  productionOrderNo?: string
  productionOrderId?: string
  materialSku?: string
  markerPlanNo?: string
  markerPlanId?: string
  ticketId?: string
  ticketNo?: string
  bagId?: string
  bagCode?: string
  usageId?: string
  usageNo?: string
  cuttingGroup?: string
  zoneCode?: string
  warehouseStatus?: string
  styleCode?: string
  sampleNo?: string
  holder?: string
  autoOpenDetail?: boolean
}): WarehouseNavigationPayload {
  return {
    cutOrders: {
      cutOrderNo: options.cutOrderNo,
      cutOrderId: options.cutOrderId,
      productionOrderNo: options.productionOrderNo,
      productionOrderId: options.productionOrderId,
      markerPlanNo: options.markerPlanNo,
      markerPlanId: options.markerPlanId,
      styleCode: options.styleCode,
      materialSku: options.materialSku,
    },
    materialPrep: {
      cutOrderNo: options.cutOrderNo,
      cutOrderId: options.cutOrderId,
      productionOrderNo: options.productionOrderNo,
      productionOrderId: options.productionOrderId,
      materialSku: options.materialSku,
      markerPlanNo: options.markerPlanNo,
      markerPlanId: options.markerPlanId,
    },
    summary: {
      cutOrderNo: options.cutOrderNo,
      cutOrderId: options.cutOrderId,
      productionOrderNo: options.productionOrderNo,
      productionOrderId: options.productionOrderId,
      markerPlanNo: options.markerPlanNo,
      markerPlanId: options.markerPlanId,
      materialSku: options.materialSku,
      styleCode: options.styleCode,
      sampleNo: options.sampleNo,
    },
    transferBags: {
      cutOrderNo: options.cutOrderNo,
      cutOrderId: options.cutOrderId,
      productionOrderNo: options.productionOrderNo,
      productionOrderId: options.productionOrderId,
      markerPlanNo: options.markerPlanNo,
      markerPlanId: options.markerPlanId,
      materialSku: options.materialSku,
      ticketId: options.ticketId,
      ticketNo: options.ticketNo,
      bagId: options.bagId,
      bagCode: options.bagCode,
      usageId: options.usageId,
      usageNo: options.usageNo,
      cuttingGroup: options.cuttingGroup,
      zoneCode: options.zoneCode,
      warehouseStatus: options.warehouseStatus,
      styleCode: options.styleCode,
      sampleNo: options.sampleNo,
      holder: options.holder,
      autoOpenDetail: options.autoOpenDetail ? '1' : undefined,
    },
  }
}

export function buildWarehouseRouteWithQuery(
  pathname: string,
  payload?: Record<string, string | undefined>,
): string {
  if (!payload) return pathname

  const params = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function getWarehouseSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}
