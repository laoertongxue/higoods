import { registerFormalProductionOrderDyeWorkOrder } from './dyeing-task-domain.ts'
import {
  issueProcessWorkOrderIdentity,
  listProcessWorkOrders,
  type FormalProductionOrderMaterialItem,
  type ProcessWorkOrderSourceSnapshot,
} from './process-work-order-domain.ts'
import { registerFormalProductionOrderPrintWorkOrder } from './printing-task-domain.ts'

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

export interface EnsuredProcessWorkOrders {
  dyeWorkOrderId?: string
  printWorkOrderId?: string
}

function requireSourceField(value: string | undefined, message: string): string {
  const normalized = value?.trim()
  if (!normalized) throw new Error(message)
  return normalized
}

function normalizeOptionalSourceField(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

function normalizeSourceSnapshot(source: ProcessWorkOrderSourceSnapshot): ProcessWorkOrderSourceSnapshot {
  const common = {
    productionOrderId: normalizeOptionalSourceField(source.productionOrderId),
    productionOrderNo: normalizeOptionalSourceField(source.productionOrderNo),
    techPackVersionId: normalizeOptionalSourceField(source.techPackVersionId),
    techPackVersionLabel: normalizeOptionalSourceField(source.techPackVersionLabel),
    bomItemId: normalizeOptionalSourceField(source.bomItemId),
    supplementRecordId: normalizeOptionalSourceField(source.supplementRecordId),
    supplementRecordNo: normalizeOptionalSourceField(source.supplementRecordNo),
    originalCutOrderId: normalizeOptionalSourceField(source.originalCutOrderId),
    originalCutOrderNo: normalizeOptionalSourceField(source.originalCutOrderNo),
    stockMaterialId: normalizeOptionalSourceField(source.stockMaterialId),
    stockMaterialName: normalizeOptionalSourceField(source.stockMaterialName),
  }

  if (source.sourceType === 'STOCK') {
    return {
      sourceType: 'STOCK',
      stockMaterialId: requireSourceField(common.stockMaterialId, '备货来源必须携带库存物料 ID'),
      stockMaterialName: requireSourceField(common.stockMaterialName, '备货来源必须携带库存物料名称'),
    }
  }

  if (source.sourceType !== 'PRODUCTION_ORDER' && source.sourceType !== 'CUT_PIECE_SUPPLEMENT') {
    throw new Error('加工单来源类型无效')
  }

  const productionFields = {
    productionOrderId: requireSourceField(common.productionOrderId, '加工单来源必须携带生产单 ID'),
    productionOrderNo: requireSourceField(common.productionOrderNo, '加工单来源必须携带生产单号'),
    techPackVersionId: requireSourceField(common.techPackVersionId, '加工单来源必须携带技术包版本 ID'),
    techPackVersionLabel: requireSourceField(common.techPackVersionLabel, '加工单来源必须携带技术包版本名称'),
    bomItemId: requireSourceField(common.bomItemId, '加工单来源必须携带 BOM 行 ID'),
  }
  if (source.sourceType === 'PRODUCTION_ORDER') {
    return { sourceType: 'PRODUCTION_ORDER', ...productionFields }
  }
  return {
    sourceType: 'CUT_PIECE_SUPPLEMENT',
    ...productionFields,
    supplementRecordId: requireSourceField(common.supplementRecordId, '补料来源必须携带补料记录 ID'),
    supplementRecordNo: requireSourceField(common.supplementRecordNo, '补料来源必须携带补料记录号'),
    originalCutOrderId: requireSourceField(common.originalCutOrderId, '补料来源必须携带原始裁片单 ID'),
    originalCutOrderNo: requireSourceField(common.originalCutOrderNo, '补料来源必须携带原始裁片单号'),
  }
}

export function buildProcessWorkOrderSourceKey(
  input: ProcessWorkOrderGenerationInput,
  processCode: 'DYE' | 'PRINT',
): string {
  if (processCode !== 'DYE' && processCode !== 'PRINT') throw new Error('加工工艺类型无效')
  const source = normalizeSourceSnapshot(input.source)
  const keyFields: Array<readonly [string, string]> = [
    ['version', '1'],
    ['sourceType', source.sourceType],
    ['processCode', processCode],
  ]
  if (source.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    keyFields.push(
      ['supplementRecordId', source.supplementRecordId!],
      ['originalCutOrderId', source.originalCutOrderId!],
      ['techPackVersionId', source.techPackVersionId!],
      ['bomItemId', source.bomItemId!],
    )
  } else if (source.sourceType === 'STOCK') {
    keyFields.push(
      ['stockMaterialId', source.stockMaterialId!],
      ['orderedAt', requireSourceField(input.orderedAt, '备货来源必须携带创建时间')],
    )
  } else {
    keyFields.push(
      ['productionOrderId', source.productionOrderId!],
      ['techPackVersionId', source.techPackVersionId!],
      ['bomItemId', source.bomItemId!],
    )
  }
  return JSON.stringify(keyFields)
}

function validateGenerationInput(input: ProcessWorkOrderGenerationInput): ProcessWorkOrderGenerationInput {
  const source = normalizeSourceSnapshot(input.source)
  const orderedAt = requireSourceField(input.orderedAt, '加工单创建时间不能为空')
  const materialId = input.materialId.trim()
  const materialName = input.materialName.trim()
  const qtyUnit = input.qtyUnit.trim()
  if (!materialId || !materialName) throw new Error('加工物料不能为空')
  if (!Number.isFinite(input.plannedQty) || input.plannedQty <= 0 || !qtyUnit) {
    throw new Error('加工数量和单位必须有效')
  }
  if (input.processCodes.length === 0 || input.processCodes.some((code) => code !== 'DYE' && code !== 'PRINT')) {
    throw new Error('印染加工工艺必须为染色或印花')
  }
  return {
    ...input,
    source,
    orderedAt,
    materialId,
    materialName,
    qtyUnit,
    processCodes: [...input.processCodes],
  }
}

export function ensureProcessWorkOrders(input: ProcessWorkOrderGenerationInput): EnsuredProcessWorkOrders {
  const normalizedInput = validateGenerationInput(input)
  const processCodes = new Set(normalizedInput.processCodes)
  const sourceSnapshot = { ...normalizedInput.source }
  const productionOrderId = sourceSnapshot.productionOrderId || ''
  const productionOrderNo = sourceSnapshot.productionOrderNo || ''
  const techPackVersionId = sourceSnapshot.techPackVersionId || ''
  const techPackVersionLabel = sourceSnapshot.techPackVersionLabel || (sourceSnapshot.sourceType === 'STOCK' ? '备货创建' : '')
  const common = {
    productionOrderId,
    productionOrderNo,
    orderedAt: normalizedInput.orderedAt,
    techPackVersionId,
    techPackVersionLabel,
    materialId: normalizedInput.materialId,
    materialName: normalizedInput.materialName,
    materialItems: normalizedInput.materialItems.map((item) => ({ ...item })),
    targetColor: normalizedInput.targetColor,
    plannedQty: normalizedInput.plannedQty,
    qtyUnit: normalizedInput.qtyUnit,
    processCodes: [...normalizedInput.processCodes],
    factoryId: normalizedInput.factoryId,
    factoryName: normalizedInput.factoryName,
    spuCode: normalizedInput.spuCode,
    spuName: normalizedInput.spuName,
    requiredDeliveryDate: normalizedInput.requiredDeliveryDate,
    plannedFinishAt: normalizedInput.plannedFinishAt,
    createdBy: normalizedInput.createdBy,
    sourceSnapshot,
  }
  const result: EnsuredProcessWorkOrders = {}

  if (processCodes.has('DYE')) {
    const sourceKey = buildProcessWorkOrderSourceKey(normalizedInput, 'DYE')
    const existing = listProcessWorkOrders('DYE').find((order) => order.sourceKey === sourceKey)
    result.dyeWorkOrderId = existing?.workOrderId || registerFormalProductionOrderDyeWorkOrder({
      ...common,
      ...issueProcessWorkOrderIdentity('DYE', normalizedInput.orderedAt),
      sourceKey,
      processName: normalizedInput.dyeProcessName || '染色',
      requiresWaterSoluble: normalizedInput.requiresWaterSoluble === true,
      sampleWaitType: normalizedInput.dyeSampleWaitType,
    }).dyeOrderId
  }

  if (processCodes.has('PRINT')) {
    const sourceKey = buildProcessWorkOrderSourceKey(normalizedInput, 'PRINT')
    const existing = listProcessWorkOrders('PRINT').find((order) => order.sourceKey === sourceKey)
    result.printWorkOrderId = existing?.workOrderId || registerFormalProductionOrderPrintWorkOrder({
      ...common,
      ...issueProcessWorkOrderIdentity('PRINT', normalizedInput.orderedAt),
      sourceKey,
      processName: normalizedInput.printProcessName || '印花',
    }).printOrderId
  }

  return result
}
