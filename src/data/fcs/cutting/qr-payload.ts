export const CUTTING_QR_PREFIX = 'FCSQR'
export const CUTTING_QR_VERSION = '2.0.0'

export type CuttingQrCodeType = 'ORIGINAL_CUT_ORDER' | 'FEI_TICKET' | 'CARRIER'

export interface CuttingQrOperatorLike {
  operatorAccountId?: string
  operatorName?: string
}

interface CuttingQrPayloadBase<Type extends CuttingQrCodeType> {
  codeType: Type
  version: string
  issuedAt: string
}

export interface OriginalCutOrderQrPayload extends CuttingQrPayloadBase<'ORIGINAL_CUT_ORDER'> {
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
}

export interface FeiTicketQrPayload extends CuttingQrPayloadBase<'FEI_TICKET'> {
  feiTicketId: string
  feiTicketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceOutputLineId: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  garmentSkuId: string
  garmentColor: string
  pieceScope: string[]
  pieceGroup: string
  bundleScope: string
  skuColor: string
  skuSize: string
  partCode: string
  partName: string
  bundleNo: string
  bundleQty: number
  actualCutPieceQty: number
  assemblyGroupKey: string
  qty: number
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage?: string
}

export interface CarrierQrPayload extends CuttingQrPayloadBase<'CARRIER'> {
  carrierId: string
  carrierCode: string
  carrierType: 'bag' | 'box'
  cycleId: string
}

export type CuttingTraceabilityQrPayload = OriginalCutOrderQrPayload | FeiTicketQrPayload | CarrierQrPayload

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
    if (parsed.codeType === 'ORIGINAL_CUT_ORDER') {
      if (!parsed.originalCutOrderId || !parsed.originalCutOrderNo) return null
      return parsed as OriginalCutOrderQrPayload
    }
    if (parsed.codeType === 'FEI_TICKET') {
      if (!parsed.feiTicketId || !parsed.feiTicketNo || !parsed.originalCutOrderId) return null
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

export function buildOriginalCutOrderQrPayload(input: {
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  issuedAt: string
}): OriginalCutOrderQrPayload {
  return {
    codeType: 'ORIGINAL_CUT_ORDER',
    version: CUTTING_QR_VERSION,
    issuedAt: input.issuedAt,
    originalCutOrderId: input.originalCutOrderId,
    originalCutOrderNo: input.originalCutOrderNo,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    materialSku: input.materialSku,
  }
}

export function buildFeiTicketQrPayload(input: {
  feiTicketId: string
  feiTicketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceOutputLineId: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  garmentSkuId: string
  garmentColor: string
  pieceScope: string[]
  pieceGroup: string
  bundleScope: string
  skuColor: string
  skuSize: string
  partCode: string
  partName: string
  bundleNo: string
  bundleQty: number
  actualCutPieceQty: number
  assemblyGroupKey: string
  qty: number
  secondaryCrafts: string[]
  craftSequenceVersion: string
  issuedAt: string
  currentCraftStage?: string
}): FeiTicketQrPayload {
  return {
    codeType: 'FEI_TICKET',
    version: CUTTING_QR_VERSION,
    issuedAt: input.issuedAt,
    feiTicketId: input.feiTicketId,
    feiTicketNo: input.feiTicketNo,
    originalCutOrderId: input.originalCutOrderId,
    originalCutOrderNo: input.originalCutOrderNo,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    sourceOutputLineId: input.sourceOutputLineId,
    fabricRollId: input.fabricRollId,
    fabricRollNo: input.fabricRollNo,
    fabricColor: input.fabricColor,
    materialSku: input.materialSku,
    garmentSkuId: input.garmentSkuId,
    garmentColor: input.garmentColor,
    pieceScope: [...input.pieceScope],
    pieceGroup: input.pieceGroup,
    bundleScope: input.bundleScope,
    skuColor: input.skuColor,
    skuSize: input.skuSize,
    partCode: input.partCode,
    partName: input.partName,
    bundleNo: input.bundleNo,
    bundleQty: Math.max(input.bundleQty, 0),
    actualCutPieceQty: Math.max(input.actualCutPieceQty, 0),
    assemblyGroupKey: input.assemblyGroupKey,
    qty: Math.max(input.qty, 0),
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
}): CarrierQrPayload {
  return {
    codeType: 'CARRIER',
    version: CUTTING_QR_VERSION,
    issuedAt: input.issuedAt,
    carrierId: input.carrierId,
    carrierCode: input.carrierCode,
    carrierType: input.carrierType,
    cycleId: input.cycleId,
  }
}
