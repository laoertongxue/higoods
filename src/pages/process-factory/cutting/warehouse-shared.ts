import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import {
  buildCuttablePoolViewModel,
  type CuttableOriginalOrderItem,
} from './cuttable-pool-model'
import {
  buildSystemSeedMergeBatches,
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  deserializeMergeBatchStorage,
  type MergeBatchRecord,
} from './merge-batches-model'
import { buildOriginalCutOrderViewModel, type OriginalCutOrderRow } from './original-orders-model'

export interface WarehouseNavigationPayload {
  originalOrders: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  summary: Record<string, string | undefined>
  transferBags: Record<string, string | undefined>
}

export function buildWarehouseQueryPayload(options: {
  originalCutOrderNo?: string
  originalCutOrderId?: string
  productionOrderNo?: string
  materialSku?: string
  mergeBatchNo?: string
  cuttingGroup?: string
  zoneCode?: string
  warehouseStatus?: string
  styleCode?: string
  sampleNo?: string
  holder?: string
}): WarehouseNavigationPayload {
  return {
    originalOrders: {
      originalCutOrderNo: options.originalCutOrderNo,
      originalCutOrderId: options.originalCutOrderId,
      productionOrderNo: options.productionOrderNo,
      mergeBatchNo: options.mergeBatchNo,
      styleCode: options.styleCode,
      materialSku: options.materialSku,
    },
    materialPrep: {
      originalCutOrderNo: options.originalCutOrderNo,
      originalCutOrderId: options.originalCutOrderId,
      productionOrderNo: options.productionOrderNo,
      materialSku: options.materialSku,
    },
    summary: {
      originalCutOrderNo: options.originalCutOrderNo,
      productionOrderNo: options.productionOrderNo,
      mergeBatchNo: options.mergeBatchNo,
      materialSku: options.materialSku,
      styleCode: options.styleCode,
      sampleNo: options.sampleNo,
    },
    transferBags: {
      originalCutOrderNo: options.originalCutOrderNo,
      productionOrderNo: options.productionOrderNo,
      mergeBatchNo: options.mergeBatchNo,
      cuttingGroup: options.cuttingGroup,
      zoneCode: options.zoneCode,
      warehouseStatus: options.warehouseStatus,
      styleCode: options.styleCode,
      sampleNo: options.sampleNo,
      holder: options.holder,
    },
  }
}

export function buildWarehouseRouteWithQuery(pathname: string, payload?: Record<string, string | undefined>): string {
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

export function readWarehouseMergeBatchLedger(): MergeBatchRecord[] {
  try {
    const stored = deserializeMergeBatchStorage(localStorage.getItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY))
    const cuttableItemsById = buildCuttablePoolViewModel(cuttingOrderProgressRecords).itemsById as Record<string, CuttableOriginalOrderItem>
    const systemSeed = buildSystemSeedMergeBatches(Object.values(cuttableItemsById))
    const merged = new Map<string, MergeBatchRecord>()
    systemSeed.forEach((batch) => merged.set(batch.mergeBatchId, batch))
    stored.forEach((batch) => merged.set(batch.mergeBatchId, batch))
    return Array.from(merged.values())
  } catch {
    return []
  }
}

export function buildWarehouseOriginalRows(): OriginalCutOrderRow[] {
  return buildOriginalCutOrderViewModel(cuttingOrderProgressRecords, readWarehouseMergeBatchLedger()).rows
}
