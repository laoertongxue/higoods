import { listFactoryWaitProcessStockItems } from './factory-internal-warehouse.ts'

export interface ProcessWorkOrderStockMaterial {
  stockMaterialId: string
  stockMaterialName: string
  materialSku: string
  availableQty: number
  qtyUnit: string
  warehouseName: string
}

export function listProcessWorkOrderStockMaterials(): ProcessWorkOrderStockMaterial[] {
  return listFactoryWaitProcessStockItems()
    .filter((item) => item.itemKind === '面料' && item.receivedQty > 0 && Boolean(item.materialSku?.trim()))
    .map((item) => ({
      stockMaterialId: item.stockItemId,
      stockMaterialName: item.itemName,
      materialSku: item.materialSku!.trim(),
      availableQty: item.receivedQty,
      qtyUnit: item.unit,
      warehouseName: item.warehouseName,
    }))
}

export function getProcessWorkOrderStockMaterial(stockMaterialId: string): ProcessWorkOrderStockMaterial | undefined {
  const normalizedId = stockMaterialId.trim()
  return listProcessWorkOrderStockMaterials().find((item) => item.stockMaterialId === normalizedId)
}

export function isValidProcessWorkOrderPlannedFinishAt(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!match) return false
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0'] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second
}
