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

export function buildProcessWorkOrderSourceKey(
  input: ProcessWorkOrderGenerationInput,
  processCode: 'DYE' | 'PRINT',
): string {
  if (input.source.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    return [
      input.source.supplementRecordId,
      input.source.originalCutOrderId,
      input.source.techPackVersionId,
      input.source.bomItemId,
      processCode,
    ].join('|')
  }
  if (input.source.sourceType === 'STOCK') {
    return [input.source.stockMaterialId, input.orderedAt, processCode].join('|')
  }
  return [
    input.source.productionOrderId,
    input.source.techPackVersionId,
    input.source.bomItemId,
    processCode,
  ].join('|')
}

function requireSourceField(value: string | undefined, message: string): void {
  if (!value?.trim()) throw new Error(message)
}

function validateGenerationInput(input: ProcessWorkOrderGenerationInput): void {
  if (input.source.sourceType === 'STOCK') {
    requireSourceField(input.source.stockMaterialId, '备货来源必须携带库存物料 ID')
    requireSourceField(input.source.stockMaterialName, '备货来源必须携带库存物料名称')
  } else {
    requireSourceField(input.source.productionOrderId, '加工单来源必须携带生产单 ID')
    requireSourceField(input.source.productionOrderNo, '加工单来源必须携带生产单号')
    requireSourceField(input.source.techPackVersionId, '加工单来源必须携带技术包版本 ID')
    requireSourceField(input.source.techPackVersionLabel, '加工单来源必须携带技术包版本名称')
    requireSourceField(input.source.bomItemId, '加工单来源必须携带 BOM 行 ID')
  }
  if (input.source.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    requireSourceField(input.source.supplementRecordId, '补料来源必须携带补料记录 ID')
    requireSourceField(input.source.supplementRecordNo, '补料来源必须携带补料记录号')
    requireSourceField(input.source.originalCutOrderId, '补料来源必须携带原始裁片单 ID')
    requireSourceField(input.source.originalCutOrderNo, '补料来源必须携带原始裁片单号')
  }
  if (!input.orderedAt.trim()) throw new Error('加工单创建时间不能为空')
  if (!input.materialId.trim() || !input.materialName.trim()) throw new Error('加工物料不能为空')
  if (!Number.isFinite(input.plannedQty) || input.plannedQty <= 0 || !input.qtyUnit.trim()) {
    throw new Error('加工数量和单位必须有效')
  }
  if (input.processCodes.length === 0 || input.processCodes.some((code) => code !== 'DYE' && code !== 'PRINT')) {
    throw new Error('印染加工工艺必须为染色或印花')
  }
}

export function ensureProcessWorkOrders(input: ProcessWorkOrderGenerationInput): EnsuredProcessWorkOrders {
  validateGenerationInput(input)
  const processCodes = new Set(input.processCodes)
  const sourceSnapshot = { ...input.source }
  const productionOrderId = sourceSnapshot.productionOrderId || ''
  const productionOrderNo = sourceSnapshot.productionOrderNo || ''
  const techPackVersionId = sourceSnapshot.techPackVersionId || ''
  const techPackVersionLabel = sourceSnapshot.techPackVersionLabel || (sourceSnapshot.sourceType === 'STOCK' ? '备货创建' : '')
  const common = {
    productionOrderId,
    productionOrderNo,
    orderedAt: input.orderedAt,
    techPackVersionId,
    techPackVersionLabel,
    materialId: input.materialId,
    materialName: input.materialName,
    materialItems: input.materialItems.map((item) => ({ ...item })),
    targetColor: input.targetColor,
    plannedQty: input.plannedQty,
    qtyUnit: input.qtyUnit,
    processCodes: [...input.processCodes],
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    spuCode: input.spuCode,
    spuName: input.spuName,
    requiredDeliveryDate: input.requiredDeliveryDate,
    plannedFinishAt: input.plannedFinishAt,
    createdBy: input.createdBy,
    sourceSnapshot,
  }
  const result: EnsuredProcessWorkOrders = {}

  if (processCodes.has('DYE')) {
    const sourceKey = buildProcessWorkOrderSourceKey(input, 'DYE')
    const existing = listProcessWorkOrders('DYE').find((order) => order.sourceKey === sourceKey)
    result.dyeWorkOrderId = existing?.workOrderId || registerFormalProductionOrderDyeWorkOrder({
      ...common,
      ...issueProcessWorkOrderIdentity('DYE', input.orderedAt),
      sourceKey,
      processName: input.dyeProcessName || '染色',
      requiresWaterSoluble: input.requiresWaterSoluble === true,
      sampleWaitType: input.dyeSampleWaitType,
    }).dyeOrderId
  }

  if (processCodes.has('PRINT')) {
    const sourceKey = buildProcessWorkOrderSourceKey(input, 'PRINT')
    const existing = listProcessWorkOrders('PRINT').find((order) => order.sourceKey === sourceKey)
    result.printWorkOrderId = existing?.workOrderId || registerFormalProductionOrderPrintWorkOrder({
      ...common,
      ...issueProcessWorkOrderIdentity('PRINT', input.orderedAt),
      sourceKey,
      processName: input.printProcessName || '印花',
    }).printOrderId
  }

  return result
}
