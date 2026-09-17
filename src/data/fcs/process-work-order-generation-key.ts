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
  inputMaterialSkuId?: string
  inputMaterialSkuCode?: string
  inputMaterialName?: string
  inputMaterialImageUrl?: string
  outputMaterialSkuId?: string
  outputMaterialSkuCode?: string
  outputMaterialName?: string
  outputMaterialImageUrl?: string
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
  if (source.sourceType === 'PRODUCTION_DEMAND') {
    if (bomItemIds.length === 0) throw new Error('生产需求提前加工单必须携带预计 BOM 行 ID')
    const demandQty = Number(source.demandQty)
    const unitConsumption = Number(source.estimatedUnitConsumption)
    const lossRate = Number(source.estimatedLossRate)
    const processQty = Number(source.estimatedProcessQty)
    if (![demandQty, unitConsumption, lossRate, processQty].every(Number.isFinite)
      || demandQty <= 0 || unitConsumption <= 0 || lossRate < 0 || processQty <= 0) {
      throw new Error('生产需求提前加工单的需求数量、预估单耗、损耗率和计划加工数量必须有效')
    }
    if (source.professionalResultVersion == null || !String(source.professionalResultVersion).trim()) {
      throw new Error('只有专业成果审核通过后才能创建提前加工单')
    }
    const inputSku = requireField(source.inputMaterialSkuCode || source.materialSkuCode, '提前加工单必须携带投入物料 SKU')
    const outputSku = requireField(source.outputMaterialSkuCode, '染色或印花加工必须维护产出物料 SKU')
    if (inputSku === outputSku) throw new Error('染色或印花加工必然生成新的物料 SKU，投入与产出 SKU 不能相同')
    return {
      ...structuredClone(source),
      sourceType: 'PRODUCTION_DEMAND',
      productionDemandId: requireField(source.productionDemandId, '提前加工单必须携带生产需求单 ID'),
      productionDemandNo: optionalField(source.productionDemandNo) || requireField(source.productionDemandId, '提前加工单必须携带生产需求单号'),
      professionalTaskId: requireField(source.professionalTaskId, '提前加工单必须携带专业任务 ID'),
      professionalTaskNo: optionalField(source.professionalTaskNo),
      professionalResultId: requireField(source.professionalResultId, '提前加工单必须携带审核通过的专业成果 ID'),
      professionalResultVersion: requireField(source.professionalResultVersion, '提前加工单必须携带审核通过的专业成果版本'),
      professionalResultApprovedAt: requireField(source.professionalResultApprovedAt, '提前加工单必须携带专业成果审核通过时间'),
      professionalResultApprovedBy: requireField(source.professionalResultApprovedBy, '提前加工单必须携带专业成果审核人'),
      targetSpuCode: requireField(source.targetSpuCode, '提前加工单必须携带目标 SPU'),
      targetSpuName: requireField(source.targetSpuName, '提前加工单必须携带目标款式名称'),
      targetSpuImageUrl: requireField(source.targetSpuImageUrl, '提前加工单必须携带款式真实图片'),
      bomItemId: bomItemIds[0],
      bomItemIds,
      materialSkuCode: requireField(source.materialSkuCode, '提前加工单必须携带投入物料 SKU'),
      inputMaterialSkuCode: inputSku,
      outputMaterialSkuCode: outputSku,
      materialName: requireField(source.materialName, '提前加工单必须携带投入物料名称'),
      materialImageUrl: requireField(source.materialImageUrl, '提前加工单必须携带投入物料真实图片'),
      demandQty,
      demandQtyUnit: requireField(source.demandQtyUnit, '提前加工单必须携带需求数量单位'),
      estimatedUnitConsumption: unitConsumption,
      estimatedLossRate: lossRate,
      estimatedProcessQty: processQty,
      matchStatus: source.matchStatus || 'WAIT_PRODUCTION_ORDER',
      generationRevision: Math.max(1, Number(source.generationRevision) || 1),
      operationFacts: structuredClone(source.operationFacts || []),
    }
  }
  if (source.sourceType === 'DESIGN_REVISION') {
    if (bomItemIds.length === 0) throw new Error('设计改款加工单必须携带 BOM 行 ID')
    if (!source.materialReceivingKind || !['FABRIC', 'ACCESSORY', 'YARN'].includes(source.materialReceivingKind)) throw new Error('设计改款加工单必须携带投入物料收货类型')
    return {
      sourceType: 'DESIGN_REVISION',
      designRevisionTaskId: requireField(source.designRevisionTaskId, '设计改款来源必须携带任务 ID'),
      designRevisionTaskNo: requireField(source.designRevisionTaskNo, '设计改款来源必须携带任务号'),
      professionalTaskId: requireField(source.professionalTaskId, '设计改款来源必须携带专业任务 ID'),
      professionalTaskNo: optionalField(source.professionalTaskNo),
      // 加工单与专业任务同时建立，此时专业结果尚未产生。
      // 结果 ID 与版本在买手审核通过后再绑定，不能为了建单伪造结果。
      professionalResultId: optionalField(source.professionalResultId),
      professionalResultVersion: optionalField(source.professionalResultVersion),
      targetSpuImageUrl: requireField(source.targetSpuImageUrl, '设计改款来源必须携带真实设计稿'),
      targetSpuCode: requireField(source.targetSpuCode, '设计改款来源必须携带目标 SPU'),
      targetSpuName: optionalField(source.targetSpuName),
      targetColorId: requireField(source.targetColorId, '设计改款来源必须携带目标颜色 ID'),
      targetColorName: optionalField(source.targetColorName),
      bomVersionId: requireField(source.bomVersionId, '设计改款来源必须携带 BOM 版本 ID'),
      bomVersionLabel: optionalField(source.bomVersionLabel),
      bomItemId: bomItemIds[0],
      bomItemIds,
      materialSkuCode: requireField(source.materialSkuCode, '设计改款加工单必须携带投入物料 SKU'),
      materialName: requireField(source.materialName, '设计改款加工单必须携带投入物料名称'),
      materialReceivingKind: source.materialReceivingKind,
      materialImageUrl: requireField(source.materialImageUrl, '设计改款加工单必须携带投入物料真实图片'),
      materialColor: requireField(source.materialColor, '设计改款加工单必须携带投入物料颜色'),
      materialComposition: requireField(source.materialComposition, '设计改款加工单必须携带投入物料成分'),
      materialSpecification: requireField(source.materialSpecification, '设计改款加工单必须携带投入物料规格'),
      receivingTeamId: requireField(source.receivingTeamId, '设计改款加工单必须携带最终收料团队 ID'),
      receivingTeamName: requireField(source.receivingTeamName, '设计改款加工单必须携带最终收料团队'),
      receivingFactoryId: requireField(source.receivingFactoryId, '设计改款加工单必须携带销售展示样衣实际接收工厂 ID'),
      receivingFactoryName: requireField(source.receivingFactoryName, '设计改款加工单必须携带销售展示样衣实际接收工厂'),
      receivingLocationId: requireField(source.receivingLocationId, '设计改款加工单必须携带最终收料位置 ID'),
      receivingLocationName: requireField(source.receivingLocationName, '设计改款加工单必须携带最终收料位置'),
      upstreamWorkOrderId: optionalField(source.upstreamWorkOrderId),
      upstreamWorkOrderNo: optionalField(source.upstreamWorkOrderNo),
      downstreamWorkOrderId: optionalField(source.downstreamWorkOrderId),
      downstreamWorkOrderNo: optionalField(source.downstreamWorkOrderNo),
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
    processEntryId: optionalField(source.processEntryId),
    routeObjectKey: optionalField(source.routeObjectKey),
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
  } else if (source.sourceType === 'PRODUCTION_DEMAND') {
    keyFields.push(
      ['productionDemandId', source.productionDemandId!],
      ['professionalTaskId', source.professionalTaskId!],
      ['professionalResultVersion', source.professionalResultVersion!],
      ['bomItemIds', source.bomItemIds!],
      ['inputMaterialSkuCode', source.inputMaterialSkuCode!],
      ['outputMaterialSkuCode', source.outputMaterialSkuCode!],
      ['generationRevision', String(source.generationRevision || 1)],
    )
  } else if (source.sourceType === 'DESIGN_REVISION') {
    keyFields.push(
      ['designRevisionTaskId', source.designRevisionTaskId!],
      ['professionalTaskId', source.professionalTaskId!],
      ['targetColorId', source.targetColorId!],
      ['bomVersionId', source.bomVersionId!],
      ['bomItemIds', source.bomItemIds!],
    )
  } else if (source.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    keyFields.push(
      ['supplementRecordId', source.supplementRecordId!],
      ['originalCutOrderId', source.originalCutOrderId!],
      ['techPackVersionId', source.techPackVersionId!],
      ['processEntryId', source.processEntryId || ''],
      ['bomItemIds', source.bomItemIds!],
    )
  } else {
    keyFields.push(
      ['productionOrderId', source.productionOrderId!],
      ['techPackVersionId', source.techPackVersionId!],
      ['processEntryId', source.processEntryId || ''],
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
  return {
    ...input,
    source,
    orderedAt,
    materialId,
    materialName,
    qtyUnit,
    inputMaterialSkuId: optionalField(input.inputMaterialSkuId),
    inputMaterialSkuCode: optionalField(input.inputMaterialSkuCode) || materialId,
    inputMaterialName: optionalField(input.inputMaterialName) || materialName,
    inputMaterialImageUrl: optionalField(input.inputMaterialImageUrl),
    outputMaterialSkuId: optionalField(input.outputMaterialSkuId),
    outputMaterialSkuCode: optionalField(input.outputMaterialSkuCode) || optionalField(input.inputMaterialSkuCode) || materialId,
    outputMaterialName: optionalField(input.outputMaterialName) || optionalField(input.inputMaterialName) || materialName,
    outputMaterialImageUrl: optionalField(input.outputMaterialImageUrl),
    processCodes: [...input.processCodes],
  }
}
