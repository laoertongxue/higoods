import { getBrowserLocalStorage, type BrowserStorageLike } from '../../browser-storage.ts'
import type { MaterialPrepRecord, MaterialPrepRecordItem, ProductionMaterialPrepWorkflowStore } from './production-material-prep.ts'

export const PRODUCTION_MATERIAL_PREP_STORAGE_KEY = 'productionMaterialPrepWorkflow'

export function roundQty(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

// 发料投影只读取已落盘确认事实，不触发历史迁移、任务生成或单位重算。
export function listStoredConfirmedMaterialPrepRecords(
  prepOrderId: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPrepRecord[] {
  try {
    const raw = storage?.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<ProductionMaterialPrepWorkflowStore>
    return Array.isArray(parsed.prepRecords)
      ? parsed.prepRecords.filter(record => record?.prepOrderId === prepOrderId && record.recordStatus === 'CONFIRMED'
        && Array.isArray(record.items) && record.items.every(item => item && Number.isFinite(item.preparedQty) && item.preparedQty >= 0))
      : []
  } catch { return [] }
}

export function getMaterialPrepRecordItems(record: MaterialPrepRecord): MaterialPrepRecordItem[] {
  const explicitItems = Array.isArray(record.items) && record.items.length > 0
    ? record.items
    : [
        {
          prepRecordItemId: `${record.prepRecordId}:item:${record.prepLineId}`,
          prepLineId: record.prepLineId,
          preparedQty: record.preparedQty,
          rollCount: record.rollCount,
          stockWarehouseName: undefined,
          stockWarehouseArea: '',
          stockLocationCode: '',
          stockAvailableQty: 0,
          warehouseArea: record.warehouseArea,
          locationCode: record.locationCode,
          sourceStockEventId: record.sourceStockEventId,
          remark: record.remark,
        },
      ]

  return explicitItems.map((item, index) => ({
    prepRecordItemId: item.prepRecordItemId || `${record.prepRecordId}:item:${index + 1}`,
    prepLineId: item.prepLineId || record.prepLineId,
    preparedQty: roundQty(Number(item.preparedQty || 0)),
    rollCount: Math.max(Math.round(item.rollCount ?? 1), 0),
    sourceMaterialSku: "sourceMaterialSku" in item ? item.sourceMaterialSku : undefined,
    sourceUnit: "sourceUnit" in item ? item.sourceUnit : undefined,
    stockWarehouseName: item.stockWarehouseName,
    stockWarehouseArea: item.stockWarehouseArea || item.warehouseArea || record.warehouseArea,
    stockLocationCode: item.stockLocationCode || item.locationCode || record.locationCode,
    stockAvailableQty: Number(item.stockAvailableQty || 0),
    warehouseArea: item.warehouseArea || record.warehouseArea,
    locationCode: item.locationCode || record.locationCode,
    sourceStockEventId: item.sourceStockEventId || record.sourceStockEventId,
    remark: item.remark || record.remark,
  }))
}
