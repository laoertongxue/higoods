export const CUTTING_QR_PREFIX = 'FCSQR'
export const CUTTING_QR_VERSION = '2.0.0'

export type CuttingQrCodeType = 'CUT_ORDER' | 'FEI_TICKET' | 'CARRIER'

export interface CuttingQrOperatorLike {
  operatorAccountId?: string
  operatorName?: string
}

interface CuttingQrPayloadBase<Type extends CuttingQrCodeType> {
  codeType: Type
  version: string
  issuedAt: string
}

export interface CutOrderQrPayload extends CuttingQrPayloadBase<'CUT_ORDER'> {
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
}

export interface FeiTicketQrPayload extends CuttingQrPayloadBase<'FEI_TICKET'> {
  payloadVersion: string
  qrType: '菲票'
  feiTicketId: string
  feiTicketNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  markerNumber: string
  bedNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  spuCode: string
  styleName: string
  color: string
  size: string
  sourceOutputLineId: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  garmentSkuId: string
  garmentColor: string
  applicableSkuCodes: string[]
  applicableSkuLabel: string
  assemblyGroupKey: string
  siblingPartTicketNos: string[]
  pieceScope: string[]
  pieceGroup: string
  bundleScope: string
  skuColor: string
  skuSize: string
  partCode: string
  partName: string
  garmentInstanceNo: number
  layerCount: number
  businessSizeLabel: string
  partQuantityPerGarment: number
  pieceQty: number
  garmentQty: number
  pieceSequenceLabel: string
  pieceSequenceStartNo: number
  pieceSequenceEndNo: number
  bundleNo: string
  bundleQty: number
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  actualCutPieceQty: number
  qty: number
  hasSpecialCraft: boolean
  specialCrafts: Array<{
    craftCategory: string
    craftType: string
    receiverFactoryCode: string
    receiverFactoryName: string
  }>
  feiTicketVersion: string
  generatedAt: string
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage?: string
}

export interface CarrierQrPayload extends CuttingQrPayloadBase<'CARRIER'> {
  carrierId: string
  carrierCode: string
  carrierType: 'bag' | 'box'
  cycleId: string
  ownershipFactoryId?: string
  ownershipFactoryName?: string
}

export type CuttingTraceabilityQrPayload = CutOrderQrPayload | FeiTicketQrPayload | CarrierQrPayload

function encodePayload(payload: CuttingTraceabilityQrPayload): string {
  return `${CUTTING_QR_PREFIX}:${encodeURIComponent(JSON.stringify(payload))}`
}

export function serializeCuttingQrPayload(payload: CuttingTraceabilityQrPayload): string {
  return encodePayload(payload)
}

export function deserializeCuttingQrPayload(value: string): CuttingTraceabilityQrPayload | null {
  if (!value) return null
  const raw = value.startsWith(`${CUTTING_QR_PREFIX}:`) ? decodeURIComponent(value.slice(CUTTING_QR_PREFIX.length + 1)) : value
  try {
    const parsed = JSON.parse(raw) as Partial<CuttingTraceabilityQrPayload>
    if (!parsed || typeof parsed !== 'object' || typeof parsed.codeType !== 'string') return null
    if (!parsed.version || !parsed.issuedAt) return null
    if (parsed.codeType === 'CUT_ORDER') {
      if (!parsed.cutOrderId || !parsed.cutOrderNo) return null
      return parsed as CutOrderQrPayload
    }
    if (parsed.codeType === 'FEI_TICKET') {
      if (!parsed.feiTicketId || !parsed.feiTicketNo || !parsed.cutOrderId) return null
      return parsed as FeiTicketQrPayload
    }
    if (parsed.codeType === 'CARRIER') {
      if (!parsed.carrierId || !parsed.carrierCode || !parsed.cycleId) return null
      return parsed as CarrierQrPayload
    }
    return null
  } catch {
    return null
  }
}

export function buildCutOrderQrPayload(input: {
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  issuedAt: string
}): CutOrderQrPayload {
  return {
    codeType: 'CUT_ORDER',
    version: CUTTING_QR_VERSION,
    issuedAt: input.issuedAt,
    cutOrderId: input.cutOrderId,
    cutOrderNo: input.cutOrderNo,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    materialSku: input.materialSku,
  }
}

export function buildFeiTicketQrPayload(input: {
  feiTicketId: string
  feiTicketNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  markerPlanId?: string
  markerPlanNo?: string
  markerNumber?: string
  bedNo?: string
  spreadingOrderId?: string
  spreadingOrderNo?: string
  spuCode?: string
  styleName?: string
  color?: string
  size?: string
  sourceOutputLineId: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  garmentSkuId: string
  garmentColor: string
  applicableSkuCodes?: string[]
  applicableSkuLabel?: string
  assemblyGroupKey?: string
  siblingPartTicketNos?: string[]
  pieceScope: string[]
  pieceGroup: string
  bundleScope: string
  skuColor: string
  skuSize: string
  partCode: string
  partName: string
  garmentInstanceNo?: number
  layerCount?: number
  businessSizeLabel?: string
  partQuantityPerGarment?: number
  pieceQty?: number
  garmentQty?: number
  pieceSequenceLabel?: string
  pieceSequenceStartNo?: number
  pieceSequenceEndNo?: number
  bundleNo: string
  bundleQty: number
  pieceSetNoStart?: number
  pieceSetNoEnd?: number
  pieceSetNoRange?: string
  bundleTicketType?: string
  actualCutPieceQty: number
  qty: number
  hasSpecialCraft?: boolean
  specialCrafts?: Array<{
    craftCategory: string
    craftType: string
    receiverFactoryCode: string
    receiverFactoryName: string
  }>
  feiTicketVersion?: string
  secondaryCrafts: string[]
  craftSequenceVersion: string
  issuedAt: string
  currentCraftStage?: string
}): FeiTicketQrPayload {
  return {
    codeType: 'FEI_TICKET',
    version: CUTTING_QR_VERSION,
    payloadVersion: CUTTING_QR_VERSION,
    qrType: '菲票',
    issuedAt: input.issuedAt,
    feiTicketId: input.feiTicketId,
    feiTicketNo: input.feiTicketNo,
    cutOrderId: input.cutOrderId,
    cutOrderNo: input.cutOrderNo,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    markerPlanId: input.markerPlanId || '',
    markerPlanNo: input.markerPlanNo || '',
    markerNumber: input.markerNumber || '',
    bedNo: input.bedNo || '',
    spreadingOrderId: input.spreadingOrderId || '',
    spreadingOrderNo: input.spreadingOrderNo || '',
    spuCode: input.spuCode || '',
    styleName: input.styleName || '',
    color: input.color || input.skuColor || input.garmentColor || input.fabricColor || '',
    size: input.size || input.skuSize || '',
    sourceOutputLineId: input.sourceOutputLineId,
    fabricRollId: input.fabricRollId,
    fabricRollNo: input.fabricRollNo,
    fabricColor: input.fabricColor,
    materialSku: input.materialSku,
    garmentSkuId: input.garmentSkuId,
    garmentColor: input.garmentColor,
    applicableSkuCodes: [...(input.applicableSkuCodes?.length ? input.applicableSkuCodes : [input.garmentSkuId].filter(Boolean))],
    applicableSkuLabel: input.applicableSkuLabel || (input.applicableSkuCodes?.length ? input.applicableSkuCodes.join(' / ') : input.garmentSkuId),
    assemblyGroupKey: input.assemblyGroupKey || [input.cutOrderNo, input.fabricRollNo, input.fabricColor, input.skuSize, input.bundleNo].filter(Boolean).join('::'),
    siblingPartTicketNos: [...(input.siblingPartTicketNos || [])],
    pieceScope: [...input.pieceScope],
    pieceGroup: input.pieceGroup,
    bundleScope: input.bundleScope,
    skuColor: input.skuColor,
    skuSize: input.skuSize,
    partCode: input.partCode,
    partName: input.partName,
    garmentInstanceNo: Math.max(input.garmentInstanceNo || 1, 1),
    layerCount: Math.max(input.layerCount || input.pieceSequenceEndNo || 0, 0),
    businessSizeLabel: input.businessSizeLabel || [input.size || input.skuSize, input.garmentInstanceNo || 1, input.layerCount || input.pieceSequenceEndNo || 0].filter(Boolean).join('-'),
    partQuantityPerGarment: Math.max(input.partQuantityPerGarment || 0, 0),
    pieceQty: Math.max(input.pieceQty ?? input.actualCutPieceQty ?? input.qty, 0),
    garmentQty: Math.max(input.garmentQty ?? input.qty ?? input.actualCutPieceQty, 0),
    pieceSequenceLabel: input.pieceSequenceLabel || '',
    pieceSequenceStartNo: Math.max(input.pieceSequenceStartNo || 0, 0),
    pieceSequenceEndNo: Math.max(input.pieceSequenceEndNo || 0, 0),
    bundleNo: input.bundleNo,
    bundleQty: Math.max(input.bundleQty, 0),
    pieceSetNoStart: Math.max(input.pieceSetNoStart || 1, 1),
    pieceSetNoEnd: Math.max(input.pieceSetNoEnd || input.bundleQty || 1, 1),
    pieceSetNoRange: input.pieceSetNoRange || `${Math.max(input.pieceSetNoStart || 1, 1)}-${Math.max(input.pieceSetNoEnd || input.bundleQty || 1, 1)}`,
    bundleTicketType: input.bundleTicketType || '扎束菲票',
    actualCutPieceQty: Math.max(input.actualCutPieceQty, 0),
    qty: Math.max(input.qty, 0),
    hasSpecialCraft: Boolean(input.hasSpecialCraft),
    specialCrafts: (input.specialCrafts || []).map((craft) => ({
      craftCategory: craft.craftCategory,
      craftType: craft.craftType,
      receiverFactoryCode: craft.receiverFactoryCode,
      receiverFactoryName: craft.receiverFactoryName,
    })),
    feiTicketVersion: input.feiTicketVersion || 'V1',
    generatedAt: input.issuedAt,
    secondaryCrafts: [...input.secondaryCrafts],
    craftSequenceVersion: input.craftSequenceVersion,
    currentCraftStage: input.currentCraftStage || '',
  }
}

export function buildCarrierQrPayload(input: {
  carrierId: string
  carrierCode: string
  carrierType: 'bag' | 'box'
  cycleId: string
  issuedAt: string
  ownershipFactoryId?: string
  ownershipFactoryName?: string
}): CarrierQrPayload {
  return {
    codeType: 'CARRIER',
    version: CUTTING_QR_VERSION,
    issuedAt: input.issuedAt,
    carrierId: input.carrierId,
    carrierCode: input.carrierCode,
    carrierType: input.carrierType,
    cycleId: input.cycleId,
    ownershipFactoryId: input.ownershipFactoryId,
    ownershipFactoryName: input.ownershipFactoryName,
  }
}
