import { listFactoryWaitProcessStockItems } from './factory-internal-warehouse.ts'

export interface ProcessWorkOrderStockMaterial {
  stockMaterialId: string
  stockMaterialName: string
  materialSku: string
  availableQty: number
  qtyUnit: string
  warehouseName: string
  factoryId: string
  factoryName: string
  processCode?: string
  processName?: string
  status: '待领料' | '已入待加工仓' | '差异待处理'
  differenceQty: number
}

function mapProcessWorkOrderStockMaterials(): ProcessWorkOrderStockMaterial[] {
  return listFactoryWaitProcessStockItems()
    .filter((item) => item.itemKind === '面料' && item.receivedQty > 0 && Boolean(item.materialSku?.trim()))
    .map((item) => ({
      stockMaterialId: item.stockItemId,
      stockMaterialName: item.itemName,
      materialSku: item.materialSku!.trim(),
      availableQty: item.receivedQty,
      qtyUnit: item.unit,
      warehouseName: item.warehouseName,
      factoryId: item.factoryId,
      factoryName: item.factoryName,
      processCode: item.processCode,
      processName: item.processName,
      status: item.status,
      differenceQty: item.differenceQty,
    }))
}

export function listProcessWorkOrderStockMaterials(filter?: {
  factoryId?: string
  processCode?: 'DYE' | 'PRINT'
}): ProcessWorkOrderStockMaterial[] {
  return mapProcessWorkOrderStockMaterials().filter((item) => (
    item.status === '已入待加工仓'
    && item.differenceQty === 0
    && (!filter?.factoryId || item.factoryId === filter.factoryId)
    && (!filter?.processCode || item.processCode === filter.processCode)
  ))
}

export function getProcessWorkOrderStockMaterial(stockMaterialId: string): ProcessWorkOrderStockMaterial | undefined {
  const normalizedId = stockMaterialId.trim()
  return mapProcessWorkOrderStockMaterials().find((item) => item.stockMaterialId === normalizedId)
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
