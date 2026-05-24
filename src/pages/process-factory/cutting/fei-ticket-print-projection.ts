import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildFeiTicketsProjection,
} from './fei-tickets-projection.ts'
import {
  buildFeiTicketQrPayload,
  type FeiTicketQrPayload,
} from '../../../data/fcs/cutting/qr-payload.ts'
import {
  formatPrintQty,
} from '../../../data/fcs/print-service.ts'

type FeiTicketPrintRecordLike = Record<string, any>

export type FeiTicketTemplateSize = '10cm x 10cm' | '15cm x 10cm'

export interface FeiTicketLabelPrintProjection {
  qrPayload: FeiTicketQrPayload
  qrDisplayValue: string
  feiTicketNo: string
  productionOrderNo: string
  cutOrderNo: string
  spuCode: string
  color: string
  size: string
  partName: string
  pieceQtyLabel: string
  pieceSequenceLabel: string
  markerPlanNo: string
  markerNumber: string
  spreadingOrderNo: string
  versionLabel: string
  hasSpecialCraftLabel: string
  specialCraftDisplayLines: string[]
  receiverFactoryDisplayLines: string[]
  templateSize: FeiTicketTemplateSize
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

function normalizePositiveNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function compactQrText(value: unknown, fallback: string): string {
  const text = normalizeText(value, fallback)
  if (text.length <= 48) return text
  return fallback || text.slice(0, 48)
}

function resolveVersionLabel(record: FeiTicketPrintRecordLike): string {
  const numericVersion = Number(record.version || 0)
  if (Number.isFinite(numericVersion) && numericVersion > 0) return `V${numericVersion}`
  return normalizeText(record.printVersionNo || record.feiTicketVersion, 'V1')
}

function resolveSpecialCrafts(record: FeiTicketPrintRecordLike): Array<{
  craftCategory: string
  craftType: string
  receiverFactoryCode: string
  receiverFactoryName: string
}> {
  return (record.specialCrafts || []).map((craft: Record<string, unknown>) => ({
    craftCategory: normalizeText(craft.craftCategory, '待补工艺大类'),
    craftType: normalizeText(craft.craftType || craft.craftName, '待补工艺类型'),
    receiverFactoryCode: normalizeText(craft.receiverFactoryCode, '待补充'),
    receiverFactoryName: normalizeText(craft.receiverFactoryName, '承接工厂待补充'),
  }))
}

function resolvePieceSequenceRange(record: FeiTicketPrintRecordLike): {
  label: string
  startNo: number
  endNo: number
} {
  const range = record.pieceSequenceRange || null
  return {
    label: normalizeText(record.pieceSequenceLabel || range?.rangeLabel, '不可生成'),
    startNo: normalizePositiveNumber(range?.startNo, 0),
    endNo: normalizePositiveNumber(range?.endNo, 0),
  }
}

function shouldUseWideTemplate(projection: Omit<FeiTicketLabelPrintProjection, 'templateSize'>): boolean {
  const longText = [
    projection.feiTicketNo,
    projection.productionOrderNo,
    projection.cutOrderNo,
    projection.spuCode,
    projection.partName,
    ...projection.specialCraftDisplayLines,
    ...projection.receiverFactoryDisplayLines,
  ].some((value) => value.length > 24)
  return longText || projection.specialCraftDisplayLines.length > 2 || projection.receiverFactoryDisplayLines.length > 2
}

export function buildFeiTicketLabelPrintProjection(
  record: FeiTicketPrintRecordLike,
  options: {
    templateSize?: FeiTicketTemplateSize
  } = {},
): FeiTicketLabelPrintProjection {
  const specialCrafts = resolveSpecialCrafts(record)
  const pieceSequence = resolvePieceSequenceRange(record)
  const pieceQty = normalizePositiveNumber(record.quantity ?? record.actualCutPieceQty ?? record.qty, 0)
  const garmentQty = normalizePositiveNumber(record.garmentQty ?? record.quantity ?? record.qty, pieceQty)
  const versionLabel = resolveVersionLabel(record)
  const qrPayload = buildFeiTicketQrPayload({
    feiTicketId: compactQrText(record.feiTicketId || record.ticketRecordId, normalizeText(record.feiTicketNo || record.ticketNo)),
    feiTicketNo: normalizeText(record.feiTicketNo || record.ticketNo),
    cutOrderId: compactQrText(record.cutOrderId || record.sourceCutOrderId, normalizeText(record.cutOrderNo || record.sourceCutOrderNo)),
    cutOrderNo: normalizeText(record.cutOrderNo || record.sourceCutOrderNo),
    productionOrderId: compactQrText(record.productionOrderId || record.sourceProductionOrderId, normalizeText(record.productionOrderNo || record.sourceProductionOrderNo)),
    productionOrderNo: normalizeText(record.productionOrderNo || record.sourceProductionOrderNo),
    markerPlanId: compactQrText(record.markerPlanId || record.sourceMarkerPlanId, normalizeText(record.markerPlanNo || record.sourceMarkerPlanNo || record.batchNo)),
    markerPlanNo: normalizeText(record.markerPlanNo || record.sourceMarkerPlanNo || record.batchNo),
    markerNumber: normalizeText(record.markerNumber || record.sourceMarkerNo),
    bedNo: normalizeText(record.bedNo || record.sourceMarkerNo),
    spreadingOrderId: compactQrText(record.spreadingOrderId || record.sourceSpreadingSessionId, normalizeText(record.spreadingOrderNo || record.sourceSpreadingSessionNo || record.spreadingSessionNo)),
    spreadingOrderNo: normalizeText(record.spreadingOrderNo || record.sourceSpreadingSessionNo || record.spreadingSessionNo),
    spuCode: normalizeText(record.sourceTechPackSpuCode || record.spuCode || record.styleCode),
    styleName: normalizeText(record.styleName || record.styleCode || record.sourceTechPackSpuCode),
    color: normalizeText(record.color || record.fabricColor || record.garmentColor || record.skuColor),
    size: normalizeText(record.size || record.skuSize),
    sourceOutputLineId: compactQrText(record.sourceOutputLineId, `${normalizeText(record.feiTicketNo || record.ticketNo)}:产出`),
    fabricRollId: compactQrText(record.fabricRollId, normalizeText(record.fabricRollNo)),
    fabricRollNo: normalizeText(record.fabricRollNo),
    fabricColor: normalizeText(record.fabricColor || record.color || record.skuColor),
    materialSku: normalizeText(record.materialSku),
    garmentSkuId: compactQrText(record.garmentSkuId || record.skuCode, `${normalizeText(record.spuCode || record.sourceTechPackSpuCode)}-${normalizeText(record.size || record.skuSize)}`),
    garmentColor: normalizeText(record.garmentColor || record.color || record.skuColor),
    pieceScope: Array.isArray(record.pieceScope) ? record.pieceScope : [normalizeText(record.partName || record.pieceGroup)],
    pieceGroup: normalizeText(record.pieceGroup || record.partName),
    bundleScope: normalizeText(record.bundleScope || record.bundleNo),
    skuColor: normalizeText(record.skuColor || record.color || record.fabricColor),
    skuSize: normalizeText(record.skuSize || record.size),
    partCode: normalizeText(record.partCode || record.partName),
    partName: normalizeText(record.partName || record.pieceGroup),
    pieceQty,
    garmentQty,
    pieceSequenceLabel: pieceSequence.label,
    pieceSequenceStartNo: pieceSequence.startNo,
    pieceSequenceEndNo: pieceSequence.endNo,
    bundleNo: normalizeText(record.bundleNo),
    bundleQty: normalizePositiveNumber(record.bundleQty ?? record.quantity, pieceQty),
    pieceSetNoStart: normalizePositiveNumber(record.pieceSetNoStart, 1),
    pieceSetNoEnd: normalizePositiveNumber(record.pieceSetNoEnd, pieceQty || 1),
    pieceSetNoRange: normalizeText(record.pieceSetNoRange, pieceSequence.label),
    bundleTicketType: normalizeText(record.bundleTicketType, '扎束菲票'),
    actualCutPieceQty: pieceQty,
    qty: pieceQty,
    hasSpecialCraft: specialCrafts.length > 0 || Boolean(record.hasSpecialCraft),
    specialCrafts,
    feiTicketVersion: versionLabel,
    secondaryCrafts: Array.isArray(record.secondaryCrafts) ? record.secondaryCrafts : specialCrafts.map((craft) => craft.craftType),
    craftSequenceVersion: normalizeText(record.craftSequenceVersion, 'actual-output-special-craft:v1'),
    issuedAt: normalizeText(record.issuedAt || record.createdAt || record.printedAt, new Date().toISOString()),
    currentCraftStage: normalizeText(record.currentCraftStage || specialCrafts[0]?.craftType),
  })
  const baseProjection = {
    qrPayload,
    qrDisplayValue: JSON.stringify(qrPayload),
    feiTicketNo: qrPayload.feiTicketNo,
    productionOrderNo: qrPayload.productionOrderNo,
    cutOrderNo: qrPayload.cutOrderNo,
    spuCode: qrPayload.spuCode,
    color: qrPayload.color,
    size: qrPayload.size,
    partName: qrPayload.partName,
    pieceQtyLabel: `裁片数量：${formatPrintQty(qrPayload.pieceQty, '片')}`,
    pieceSequenceLabel: qrPayload.pieceSequenceLabel ? `编号范围：${qrPayload.pieceSequenceLabel}` : '编号范围：不可生成',
    markerPlanNo: qrPayload.markerPlanNo,
    markerNumber: qrPayload.markerNumber,
    spreadingOrderNo: qrPayload.spreadingOrderNo,
    versionLabel,
    hasSpecialCraftLabel: qrPayload.hasSpecialCraft ? '有特殊工艺' : '无特殊工艺',
    specialCraftDisplayLines: specialCrafts.length ? specialCrafts.map((craft) => `${craft.craftType} / ${craft.craftCategory}`) : ['无'],
    receiverFactoryDisplayLines: specialCrafts.length ? specialCrafts.map((craft) => `${craft.craftType}：${craft.receiverFactoryName || '承接工厂待补充'}`) : ['无'],
  }
  return {
    ...baseProjection,
    templateSize: options.templateSize || (shouldUseWideTemplate(baseProjection) ? '15cm x 10cm' : '10cm x 10cm'),
  }
}

export function buildFeiTicketPrintProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
) {
  return buildFeiTicketsProjection(snapshot)
}
