import type {
  FormalProductionOrderMaterialItem,
  ProcessWorkOrderSourceSnapshot,
} from './process-work-order-domain.ts'

export interface ProcessWorkOrderGenerationInput {
  source: ProcessWorkOrderSourceSnapshot
  processCodes: Array<'DYE' | 'PRINT'>
  orderedAt: string
  materialId: string
  materialName: string
  materialItems: FormalProductionOrderMaterialItem[]
  targetColor: string
  plannedQty: number
  qtyUnit: string
  dyeProcessName?: string
  printProcessName?: string
  requiresWaterSoluble?: boolean
  factoryId?: string
  factoryName?: string
  spuCode: string
  spuName: string
  requiredDeliveryDate: string
  plannedFinishAt?: string
  createdBy?: string
  dyeSampleWaitType?: 'NONE' | 'WAIT_SAMPLE_GARMENT' | 'WAIT_COLOR_CARD'
}

function requireField(value: string | undefined, message: string): string {
  const normalized = value?.trim()
  if (!normalized) throw new Error(message)
  return normalized
}

function optionalField(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

function normalizeBomItemIds(source: ProcessWorkOrderSourceSnapshot): string[] {
  const ids = [...(source.bomItemIds || []), ...(source.bomItemId ? [source.bomItemId] : [])]
    .map((id) => id.trim())
    .filter(Boolean)
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right))
}

export function normalizeProcessWorkOrderSourceSnapshot(source: ProcessWorkOrderSourceSnapshot): ProcessWorkOrderSourceSnapshot {
  const bomItemIds = normalizeBomItemIds(source)
  if (source.sourceType === 'STOCK') {
    return {
      sourceType: 'STOCK',
      stockMaterialId: requireField(source.stockMaterialId, '备货来源必须携带库存物料 ID'),
      stockMaterialName: requireField(source.stockMaterialName, '备货来源必须携带库存物料名称'),
    }
  }
  if (source.sourceType !== 'PRODUCTION_ORDER' && source.sourceType !== 'CUT_PIECE_SUPPLEMENT') {
    throw new Error('加工单来源类型无效')
  }
  if (bomItemIds.length === 0) throw new Error('加工单来源必须携带 BOM 行 ID')
  const productionFields = {
    productionOrderId: requireField(source.productionOrderId, '加工单来源必须携带生产单 ID'),
    productionOrderNo: requireField(source.productionOrderNo, '加工单来源必须携带生产单号'),
    techPackVersionId: requireField(source.techPackVersionId, '加工单来源必须携带技术包版本 ID'),
    techPackVersionLabel: requireField(source.techPackVersionLabel, '加工单来源必须携带技术包版本名称'),
    bomItemId: bomItemIds[0],
    bomItemIds,
  }
  if (source.sourceType === 'PRODUCTION_ORDER') return { sourceType: 'PRODUCTION_ORDER', ...productionFields }
  return {
    sourceType: 'CUT_PIECE_SUPPLEMENT',
    ...productionFields,
    supplementRecordId: requireField(source.supplementRecordId, '补料来源必须携带补料记录 ID'),
    supplementRecordNo: requireField(source.supplementRecordNo, '补料来源必须携带补料记录号'),
    originalCutOrderId: requireField(source.originalCutOrderId, '补料来源必须携带原始裁片单 ID'),
    originalCutOrderNo: requireField(source.originalCutOrderNo, '补料来源必须携带原始裁片单号'),
  }
}

export function buildProcessWorkOrderSourceKey(input: ProcessWorkOrderGenerationInput, processCode: 'DYE' | 'PRINT'): string {
  if (processCode !== 'DYE' && processCode !== 'PRINT') throw new Error('加工工艺类型无效')
  const source = normalizeProcessWorkOrderSourceSnapshot(input.source)
  const keyFields: Array<readonly [string, string | readonly string[]]> = [
    ['version', '2'],
    ['sourceType', source.sourceType],
    ['processCode', processCode],
  ]
  if (source.sourceType === 'STOCK') {
    keyFields.push(['stockMaterialId', source.stockMaterialId!], ['orderedAt', requireField(input.orderedAt, '备货来源必须携带创建时间')])
  } else if (source.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    keyFields.push(
      ['supplementRecordId', source.supplementRecordId!],
      ['originalCutOrderId', source.originalCutOrderId!],
      ['techPackVersionId', source.techPackVersionId!],
      ['bomItemIds', source.bomItemIds!],
    )
  } else {
    keyFields.push(
      ['productionOrderId', source.productionOrderId!],
      ['techPackVersionId', source.techPackVersionId!],
      ['bomItemIds', source.bomItemIds!],
    )
  }
  return JSON.stringify(keyFields)
}

export function normalizeProcessWorkOrderGenerationInput(input: ProcessWorkOrderGenerationInput): ProcessWorkOrderGenerationInput {
  const source = normalizeProcessWorkOrderSourceSnapshot(input.source)
  const orderedAt = requireField(input.orderedAt, '加工单创建时间不能为空')
  const materialId = input.materialId.trim()
  const materialName = input.materialName.trim()
  const qtyUnit = input.qtyUnit.trim()
  if (!materialId || !materialName) throw new Error('加工物料不能为空')
  if (!Number.isFinite(input.plannedQty) || input.plannedQty <= 0 || !qtyUnit) throw new Error('加工数量和单位必须有效')
  if (input.processCodes.length === 0 || input.processCodes.some((code) => code !== 'DYE' && code !== 'PRINT')) {
    throw new Error('印染加工工艺必须为染色或印花')
  }
  return { ...input, source, orderedAt, materialId, materialName, qtyUnit, processCodes: [...input.processCodes] }
}
