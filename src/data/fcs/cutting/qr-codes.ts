import {
  CUTTING_QR_VERSION,
  buildCarrierQrPayload,
  buildFeiTicketQrPayload,
  buildOriginalCutOrderQrPayload,
  deserializeCuttingQrPayload,
  serializeCuttingQrPayload,
  type CarrierQrPayload,
  type CuttingTraceabilityQrPayload,
  type FeiTicketQrPayload,
  type OriginalCutOrderQrPayload,
} from './qr-payload.ts'

function sanitizeFragment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'na'
}

export function buildCutOrderQrValue(originalCutOrderId: string): string {
  return `FCS:CUT_ORDER:v1:${sanitizeFragment(originalCutOrderId)}`
}

export function getCutOrderByQrValue(qrValue: string): { originalCutOrderId: string } | null {
  if (!qrValue.startsWith('FCS:CUT_ORDER:v1:')) return null
  const originalCutOrderId = qrValue.slice('FCS:CUT_ORDER:v1:'.length).trim()
  return originalCutOrderId ? { originalCutOrderId } : null
}

export function buildCuttingTraceabilityId(prefix: string, issuedAt: string, ...parts: Array<string | number | undefined>): string {
  const dateKey = issuedAt.slice(0, 16).replace(/[-:\s]/g, '') || '000000000000'
  const fragment = parts.map((part) => sanitizeFragment(String(part || ''))).filter(Boolean).join('-') || 'na'
  return `${prefix}-${dateKey}-${fragment}`
}

export function encodeOriginalCutOrderQr(input: Parameters<typeof buildOriginalCutOrderQrPayload>[0]): {
  payload: OriginalCutOrderQrPayload
  qrValue: string
} {
  const payload = buildOriginalCutOrderQrPayload(input)
  return { payload, qrValue: serializeCuttingQrPayload(payload) }
}

export function encodeFeiTicketQr(input: Parameters<typeof buildFeiTicketQrPayload>[0]): {
  payload: FeiTicketQrPayload
  qrValue: string
} {
  const payload = buildFeiTicketQrPayload(input)
  return { payload, qrValue: serializeCuttingQrPayload(payload) }
}

export function encodeCarrierQr(input: Parameters<typeof buildCarrierQrPayload>[0]): {
  payload: CarrierQrPayload
  qrValue: string
} {
  const payload = buildCarrierQrPayload(input)
  return { payload, qrValue: serializeCuttingQrPayload(payload) }
}

export function parseCuttingTraceQr(value: string): CuttingTraceabilityQrPayload | null {
  return deserializeCuttingQrPayload(value)
}

export interface CraftTraceValidationResult {
  allowed: boolean
  reason: string
  currentCraftType: string
  requiredPreviousCrafts: string[]
}

export function validateFeiCraftSequence(payload: FeiTicketQrPayload, currentCraftType: string, completedCrafts: string[] = []): CraftTraceValidationResult {
  const normalizedCurrent = currentCraftType.trim()
  const craftChain = payload.secondaryCrafts.map((item) => item.trim()).filter(Boolean)
  if (!normalizedCurrent) {
    return {
      allowed: false,
      reason: '缺少当前工艺类型，无法校验顺序。',
      currentCraftType: '',
      requiredPreviousCrafts: [],
    }
  }
  if (!craftChain.length) {
    return {
      allowed: true,
      reason: '当前菲票未配置二级工艺顺序，按自由扫码处理。',
      currentCraftType: normalizedCurrent,
      requiredPreviousCrafts: [],
    }
  }
  const currentIndex = craftChain.findIndex((item) => item === normalizedCurrent)
  if (currentIndex === -1) {
    return {
      allowed: false,
      reason: `${normalizedCurrent} 不在当前菲票工艺顺序中。`,
      currentCraftType: normalizedCurrent,
      requiredPreviousCrafts: craftChain,
    }
  }
  const requiredPreviousCrafts = craftChain.slice(0, currentIndex)
  const missing = requiredPreviousCrafts.filter((item) => !completedCrafts.includes(item))
  if (missing.length) {
    return {
      allowed: false,
      reason: `前置工艺未完成：${missing.join('、')}。`,
      currentCraftType: normalizedCurrent,
      requiredPreviousCrafts,
    }
  }
  return {
    allowed: true,
    reason: currentIndex === craftChain.length - 1 ? '当前扫码已到最后一道二级工艺。' : `下一道工艺：${craftChain[currentIndex + 1]}。`,
    currentCraftType: normalizedCurrent,
    requiredPreviousCrafts,
  }
}

export function summarizeTraceabilityPayload(payload: CuttingTraceabilityQrPayload): {
  codeTypeLabel: string
  primaryNo: string
  relationSummary: string
  schemaVersion: string
} {
  if (payload.codeType === 'ORIGINAL_CUT_ORDER') {
    return {
      codeTypeLabel: '裁片单二维码',
      primaryNo: payload.originalCutOrderNo,
      relationSummary: `${payload.productionOrderNo} / ${payload.materialSku}`,
      schemaVersion: payload.version,
    }
  }
  if (payload.codeType === 'CARRIER') {
    return {
      codeTypeLabel: payload.carrierType === 'bag' ? '中转袋父码' : '周转箱父码',
      primaryNo: payload.carrierCode,
      relationSummary: `周期 ${payload.cycleId}`,
      schemaVersion: payload.version,
    }
  }
  return {
    codeTypeLabel: '菲票子码',
    primaryNo: payload.feiTicketNo,
    relationSummary: `${payload.originalCutOrderNo} / ${payload.materialSku} / ${payload.partName}`,
    schemaVersion: payload.version,
  }
}

export { CUTTING_QR_VERSION }
